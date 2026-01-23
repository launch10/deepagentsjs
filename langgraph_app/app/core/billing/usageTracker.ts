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

  // System prompt capture (for trace completeness)
  systemPrompt?: string;
  systemPromptCaptured?: boolean;

  // Message capture for traces
  // Pushed via handleLLMEnd - avoids fragile before/after state diffs
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
  systemPrompt?: string;
  messagesProduced: BaseMessage[];
}> {
  const runId = generateUUID();
  const fullContext: UsageContext = {
    runId,
    records: [],
    messagesProduced: [],
    ...context,
  };

  return usageStorage.run(fullContext, async () => {
    const result = await fn();
    return {
      result,
      runId: fullContext.runId,
      usage: fullContext.records,
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
   * Capture the system prompt on the first LLM call of a run.
   * This ensures traces have the dynamic system prompt for replay/analysis.
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

    // Only capture once per run (system prompt is typically constant)
    if (!context.systemPromptCaptured && messages[0]) {
      const systemMessage = messages[0].find((m) => m._getType() === "system");
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
   * Extract usage from completed LLM calls.
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
          // Push message for traces
          // This captures all LLM outputs without relying on state diffs
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
