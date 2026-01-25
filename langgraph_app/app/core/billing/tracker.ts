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
import type { UsageRecord } from "./types";

class UsageTrackingCallbackHandler extends BaseCallbackHandler {
  name = "usage-tracking";

  /**
   * Capture input messages at the start of each LLM call.
   * Deduplicates to avoid counting the same message twice.
   */
  override async handleChatModelStart(
    _llm: Serialized,
    messages: BaseMessage[][],
    _runId: string
  ): Promise<void> {
    const context = getUsageContext();
    if (!context) return;

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
    if (!context) return;

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
          context.records.push(
            this.extractUsageRecord(
              context.runId,
              message,
              output.llmOutput,
              llmCallId,
              parentLlmCallId,
              tags,
              extraParams
            )
          );
        }
      }
    }
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
    extraParams?: Record<string, unknown>
  ): UsageRecord {
    const usage = (message as any).usage_metadata;
    const responseMeta = (message as any).response_metadata || llmOutput || {};

    return {
      runId,
      messageId: message.id || responseMeta.id || "",
      langchainRunId,
      parentLangchainRunId,
      model: responseMeta.model_name || responseMeta.model || "unknown",
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      reasoningTokens: usage.output_token_details?.reasoning || 0,
      cacheCreationTokens:
        usage.cache_creation_input_tokens || usage.input_token_details?.cache_creation || 0,
      cacheReadTokens: usage.cache_read_input_tokens || usage.input_token_details?.cache_read || 0,
      timestamp: new Date(),
      tags,
      metadata: extraParams?.metadata as Record<string, unknown>,
    };
  }
}

export const usageTracker = new UsageTrackingCallbackHandler();
