import { AsyncLocalStorage } from "node:async_hooks";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Serialized } from "@langchain/core/load/serializable";
import type { LLMResult } from "@langchain/core/outputs";
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import { generateUUID } from "@types";

/**
 * Raw usage record - tokens and model only.
 * Rails handles all cost calculations.
 */
export interface UsageRecord {
  runId: string; // Our graph execution ID - correlates all LLM calls from one request
  messageId: string; // Provider's message ID (e.g., "msg_01BeRfQurFVC5z4Ysn3xmVt1") - ties usage to AIMessage
  langchainRunId: string; // LangChain's internal callback run ID (useful for LangSmith)
  parentLangchainRunId?: string;
  model: string; // Raw model name from provider (e.g., "claude-haiku-4-5-20251001")
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  timestamp: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
  // NOTE: No costUsd - Rails handles all pricing calculation
}

/**
 * Context for a single graph execution run.
 * Accumulated via AsyncLocalStorage during execution.
 */
export interface UsageContext {
  runId: string; // Generated once at start - correlates all records from this request
  records: UsageRecord[];
  chatId?: number;
  threadId?: string;
  graphName?: string;

  // System prompt capture (for trace completeness / backwards compatibility)
  systemPrompt?: string;
  systemPromptCaptured?: boolean;

  /**
   * Clean ordered array of ALL messages in the conversation.
   * Captures: [SystemMessage, HumanMessage, ContextMessage, AIMessage, ToolMessage, ...]
   *
   * - Input messages captured via handleChatModelStart
   * - Output messages (AIMessage) captured via handleLLMEnd
   * - Deduplication via _seenMessageIds to avoid counting same message twice
   */
  messages: BaseMessage[];

  /**
   * Track message IDs we've already captured to avoid duplicates.
   * handleChatModelStart receives cumulative messages, so we need to detect
   * which ones are new on subsequent LLM calls.
   */
  _seenMessageIds: Set<string>;

  /**
   * Track message count from previous handleChatModelStart call.
   * Used to detect new messages when IDs aren't available.
   */
  _lastInputMessageCount: number;

  // Legacy field - kept for backwards compatibility but deprecated
  // Use `messages` instead
  messagesProduced: BaseMessage[];
  userInput?: BaseMessage; // Set at run start, not from callback
}

const usageStorage = new AsyncLocalStorage<UsageContext>();

/**
 * Get the current usage tracking context.
 * Returns undefined when called outside of runWithUsageTracking.
 */
export function getUsageContext(): UsageContext | undefined {
  return usageStorage.getStore();
}

/**
 * Execute a function with usage tracking context.
 * All LLM calls made within will have their usage tracked.
 *
 * @param context - Partial context to initialize with
 * @param fn - Function to execute with tracking
 * @returns Result along with accumulated usage and trace data
 */
export async function runWithUsageTracking<T>(
  context: Partial<Omit<UsageContext, "runId">>,
  fn: () => T | Promise<T>
): Promise<{
  result: T;
  runId: string;
  usage: UsageRecord[];
  /** Clean ordered array of ALL messages in the conversation */
  messages: BaseMessage[];
  /** @deprecated Use messages instead - kept for backwards compatibility */
  systemPrompt?: string;
  /** @deprecated Use messages instead - kept for backwards compatibility */
  messagesProduced: BaseMessage[];
}> {
  const runId = generateUUID();
  const fullContext: UsageContext = {
    runId,
    records: [],
    messages: [],
    _seenMessageIds: new Set(),
    _lastInputMessageCount: 0,
    messagesProduced: [],
    ...context,
  };

  return usageStorage.run(fullContext, async () => {
    const result = await fn();
    return {
      result,
      runId: fullContext.runId,
      usage: fullContext.records,
      messages: fullContext.messages,
      systemPrompt: fullContext.systemPrompt,
      messagesProduced: fullContext.messagesProduced,
    };
  });
}

/**
 * Callback handler that tracks LLM usage metadata.
 * Attached to every model via getLLM().
 * Safely no-ops when not inside runWithUsageTracking.
 */
class UsageTrackingCallbackHandler extends BaseCallbackHandler {
  name = "usage-tracking";

  /**
   * Capture input messages for the trace.
   * Called at the START of each LLM call with the full conversation so far.
   *
   * On first call: captures all input messages (System, Human, Context, etc.)
   * On subsequent calls: captures only NEW messages (ToolMessage, etc.)
   *
   * NOTE: Use handleChatModelStart (not handleLLMStart) for chat models.
   * - handleLLMStart: Traditional LLMs (string completion), receives prompts: string[]
   * - handleChatModelStart: Chat models (Anthropic, OpenAI chat), receives messages: BaseMessage[][]
   */
  override async handleChatModelStart(
    _llm: Serialized,
    messages: BaseMessage[][], // Note: 2D array - messages[0] is the conversation
    _runId: string,
    _parentRunId?: string,
    _extraParams?: Record<string, unknown>,
    _tags?: string[],
    _metadata?: Record<string, unknown>
  ): Promise<void> {
    const context = getUsageContext();
    if (!context) return;

    const inputMessages = messages[0] ?? [];

    // Capture input messages, avoiding duplicates
    for (const msg of inputMessages) {
      const msgId = this.getMessageId(msg);

      // Skip if we've already captured this message
      if (context._seenMessageIds.has(msgId)) {
        continue;
      }

      context._seenMessageIds.add(msgId);
      context.messages.push(msg);
    }

    // Track input count for deduplication
    context._lastInputMessageCount = inputMessages.length;

    // Backwards compatibility: capture system prompt as string
    if (!context.systemPromptCaptured && inputMessages.length > 0) {
      const systemMessage = inputMessages.find((m) => m._getType() === "system");
      if (systemMessage) {
        context.systemPrompt =
          typeof systemMessage.content === "string"
            ? systemMessage.content
            : JSON.stringify(systemMessage.content);
        context.systemPromptCaptured = true;
      }
    }
  }

  /**
   * Generate a unique ID for a message for deduplication.
   * Uses message.id if available, otherwise creates a content-based hash.
   */
  private getMessageId(msg: BaseMessage): string {
    // Prefer actual message ID if available
    if (msg.id) {
      return msg.id;
    }

    // Fallback: create content-based ID
    const type = msg._getType();
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    const name = (msg as any).name ?? "";
    const toolCallId = (msg as any).tool_call_id ?? "";

    // Simple hash for deduplication
    return `${type}:${name}:${toolCallId}:${content.slice(0, 100)}`;
  }

  /**
   * Extract usage and capture output message from completed LLM calls.
   * Called for every LLM invocation (agents, tools, middleware).
   */
  override async handleLLMEnd(
    output: LLMResult,
    llmCallId: string,
    parentLlmCallId?: string,
    tags?: string[],
    extraParams?: Record<string, unknown>
  ): Promise<void> {
    const context = getUsageContext();
    if (!context) return; // Not in a tracked context - safe no-op

    for (const generationBatch of output.generations ?? []) {
      for (const generation of generationBatch) {
        const message = (generation as any).message as AIMessage | undefined;
        if (message) {
          // Add to clean messages array (avoiding duplicates)
          const msgId = this.getMessageId(message);
          if (!context._seenMessageIds.has(msgId)) {
            context._seenMessageIds.add(msgId);
            context.messages.push(message);
          }

          // Legacy: also add to messagesProduced for backwards compatibility
          context.messagesProduced.push(message);

          // Push usage record for billing
          if (message.usage_metadata) {
            const record = this.extractUsageRecord(
              context.runId,
              message,
              output.llmOutput,
              llmCallId,
              parentLlmCallId,
              tags,
              extraParams
            );
            context.records.push(record);
          }
        }
      }
    }
  }

  private extractUsageRecord(
    runId: string,
    message: AIMessage,
    llmOutput: any,
    langchainRunId: string,
    parentLangchainRunId?: string,
    tags?: string[],
    extraParams?: Record<string, unknown>
  ): UsageRecord {
    const usage = (message as any).usage_metadata;
    const responseMeta = (message as any).response_metadata || llmOutput || {};

    // Model name: OpenAI uses model_name, Anthropic uses model
    // Store raw model name - Rails handles normalization for pricing
    const model = responseMeta.model_name || responseMeta.model || "unknown";

    // Message ID from provider (e.g., "msg_01BeRfQurFVC5z4Ysn3xmVt1" for Anthropic)
    // Ties usage record to the specific AIMessage for trace correlation
    const messageId = message.id || responseMeta.id || "";

    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const reasoningTokens = usage.output_token_details?.reasoning || 0;
    const cacheCreationTokens =
      usage.cache_creation_input_tokens || usage.input_token_details?.cache_creation || 0;
    const cacheReadTokens =
      usage.cache_read_input_tokens || usage.input_token_details?.cache_read || 0;

    // NOTE: No cost calculation here - Rails handles all pricing
    return {
      runId,
      messageId,
      langchainRunId,
      parentLangchainRunId,
      model,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cacheCreationTokens,
      cacheReadTokens,
      timestamp: new Date(),
      tags,
      metadata: extraParams?.metadata as Record<string, unknown>,
    };
  }
}

export const usageTracker = new UsageTrackingCallbackHandler();
