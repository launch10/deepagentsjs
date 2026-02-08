/**
 * Usage Tracking Callback Handler
 *
 * Attached to every LLM via getLLM(). Captures token usage and messages
 * into the AsyncLocalStorage context. No-ops safely when not in a tracked context.
 */
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Serialized } from "@langchain/core/load/serializable";
import type { LLMResult } from "@langchain/core/outputs";
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import { getUsageContext } from "./storage";
import { getLogger } from "../logger";
import type { UsageRecord } from "./types";

class UsageTrackingCallbackHandler extends BaseCallbackHandler {
  name = "usage-tracking";

  /**
   * Capture input messages at the start of each LLM call.
   * Deduplicates to avoid counting the same message twice.
   * Also stores metadata (including _modelCard) in the usage context for handleLLMEnd.
   */
  override async handleChatModelStart(
    _llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    _parentRunId?: string,
    _extraParams?: Record<string, unknown>,
    _tags?: string[],
    metadata?: Record<string, unknown>,
    _runName?: string
  ): Promise<void> {
    const context = getUsageContext();
    if (!context) {
      getLogger({ component: "UsageTracker" }).warn({ runId }, "handleChatModelStart: no usage context — LLM call will NOT be tracked");
      return;
    }

    // Store metadata in context for this langchain runId so we can access _modelCard in handleLLMEnd
    // Using the context's Map ensures automatic cleanup when the context ends
    if (metadata) {
      context._runIdToMetadata.set(runId, metadata);
    }

    const inputMessages = messages[0] ?? [];

    for (const msg of inputMessages) {
      const msgId = this.getMessageId(msg);
      if (context._seenMessageIds.has(msgId)) continue;

      context._seenMessageIds.add(msgId);
      context.messages.push(msg);
    }
  }

  /**
   * Extract usage metadata and capture output messages.
   */
  override async handleLLMEnd(
    output: LLMResult,
    llmCallId: string,
    parentLlmCallId?: string,
    tags?: string[],
    extraParams?: Record<string, unknown>
  ): Promise<void> {
    const context = getUsageContext();
    if (!context) {
      getLogger({ component: "UsageTracker" }).warn({ runId: llmCallId }, "handleLLMEnd: no usage context — usage record lost");
      return;
    }

    // Retrieve metadata stored in handleChatModelStart (includes _modelCard)
    const storedMetadata = context._runIdToMetadata.get(llmCallId);

    for (const generationBatch of output.generations ?? []) {
      for (const generation of generationBatch) {
        const message = (generation as any).message as AIMessage | undefined;
        if (!message) continue;

        // Add output message to trace
        const msgId = this.getMessageId(message);
        if (!context._seenMessageIds.has(msgId)) {
          context._seenMessageIds.add(msgId);
          context.messages.push(message);
        }

        // Record usage for billing
        if (message.usage_metadata) {
          const record = this.extractUsageRecord(
            context.runId,
            message,
            output.llmOutput,
            llmCallId,
            parentLlmCallId,
            tags,
            extraParams,
            storedMetadata
          );
          context.records.push(record);
          getLogger({ component: "UsageTracker" }).debug({ model: record.model, inputTokens: record.inputTokens, outputTokens: record.outputTokens, totalRecords: context.records.length }, "Recorded usage");
        } else {
          getLogger({ component: "UsageTracker" }).warn({ runId: llmCallId }, "handleLLMEnd: message has no usage_metadata");
        }
      }
    }

    // Clean up stored metadata after use (context cleanup handles overall cleanup)
    context._runIdToMetadata.delete(llmCallId);
  }

  private getMessageId(msg: BaseMessage): string {
    if (msg.id) return msg.id;

    const type = msg._getType();
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    const name = (msg as any).name ?? "";
    const toolCallId = (msg as any).tool_call_id ?? "";

    return `${type}:${name}:${toolCallId}:${content.slice(0, 100)}`;
  }

  private extractUsageRecord(
    runId: string,
    message: AIMessage,
    llmOutput: any,
    langchainRunId: string,
    parentLangchainRunId?: string,
    tags?: string[],
    extraParams?: Record<string, unknown>,
    storedMetadata?: Record<string, unknown>
  ): UsageRecord {
    const usage = (message as any).usage_metadata;
    const responseMeta = (message as any).response_metadata || llmOutput || {};

    // LangChain's streaming handler sums message_start + message_delta usage,
    // but Anthropic's message_delta repeats cache token counts (cumulative, not
    // incremental). This exactly doubles cache_creation and cache_read tokens in
    // usage_metadata. The raw Anthropic data in response_metadata.usage is NOT
    // merged across streaming chunks and contains the correct values.
    const rawAnthropicUsage = (message as any).response_metadata?.usage;

    // Get model name for billing - prefer _modelCard since it's set at creation time
    // and guaranteed to match our cost configuration. Response metadata is a fallback
    // in case the config metadata isn't available (e.g., direct LLM usage without getLLM wrapper)
    //
    // Priority:
    // 1. storedMetadata._modelCard - captured from handleChatModelStart's metadata param (most reliable)
    // 2. extraParams.metadata._modelCard - in case LangChain passes it through (less common)
    // 3. responseMeta.model_name - OpenAI style response
    // 4. responseMeta.model - Anthropic style response
    const configMetadata = extraParams?.metadata as Record<string, unknown> | undefined;
    const model =
      storedMetadata?._modelCard ||
      configMetadata?._modelCard ||
      responseMeta.model_name ||
      responseMeta.model ||
      "unknown";

    // Warn early when model is unknown to help debug cost calculation errors
    if (model === "unknown") {
      getLogger({ component: "UsageTracker" }).warn(
        { langchainRunId, tags, responseMeta, storedMetadata, configMetadata },
        "Unknown model detected — cost calculation may fail"
      );
    }

    return {
      runId,
      messageId: message.id || responseMeta.id || "",
      langchainRunId,
      parentLangchainRunId,
      model,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      reasoningTokens: usage.output_token_details?.reasoning || 0,
      cacheCreationTokens:
        rawAnthropicUsage?.cache_creation_input_tokens ??
        usage.input_token_details?.cache_creation ??
        0,
      cacheReadTokens:
        rawAnthropicUsage?.cache_read_input_tokens ??
        usage.input_token_details?.cache_read ??
        0,
      timestamp: new Date(),
      tags,
      metadata: storedMetadata ?? (extraParams?.metadata as Record<string, unknown>),
    };
  }
}

export const usageTracker = new UsageTrackingCallbackHandler();
