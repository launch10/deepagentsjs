/**
 * Billing Persistence
 *
 * Writes usage records and conversation traces to the database.
 * Both are billing-critical - retries on transient failures.
 */
import type { BaseMessage } from "@langchain/core/messages";
import { isContextMessage } from "langgraph-ai-sdk";
import { db, llmUsage, llmConversationTraces } from "@db";
import type {
  UsageRecord,
  UsagePersistContext,
  TraceContext,
  UsageSummary,
  SerializedMessage,
} from "./types";
import { calculateCost } from "../llm/cost";
import { getLogger } from "../logger";
import type { ModelConfig } from "../llm/types";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// USAGE PERSISTENCE
// ============================================================================

/**
 * Transform usage records to database row format.
 * Exported for testing.
 */
export function prepareUsageRecordsForInsert(
  records: UsageRecord[],
  context: UsagePersistContext,
  modelConfigs?: Record<string, ModelConfig>
) {
  return records.map((record) => {
    let costMillicredits: number | null = null;
    if (modelConfigs) {
      try {
        costMillicredits = calculateCost(record, modelConfigs);
      } catch {
          // Model not found in configs — leave null, Rails will calculate later
      }
    }

    return {
      chatId: context.chatId,
      threadId: context.threadId,
      runId: record.runId,
      messageId: record.messageId,
      langchainRunId: record.langchainRunId,
      parentLangchainRunId: record.parentLangchainRunId,
      graphName: context.graphName,
      modelRaw: record.model,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      reasoningTokens: record.reasoningTokens,
      cacheCreationTokens: record.cacheCreationTokens,
      cacheReadTokens: record.cacheReadTokens,
      costMillicredits,
      tags: record.tags,
      metadata: record.metadata,
      createdAt: record.timestamp.toISOString(),
    };
  });
}

/**
 * Persist usage records to the llm_usage table.
 * Uses exponential backoff retry for transient failures.
 */
export async function persistUsage(
  records: UsageRecord[],
  context: UsagePersistContext,
  modelConfigs?: Record<string, ModelConfig>
): Promise<void> {
  if (records.length === 0) return;
  const log = getLogger({ component: "persistUsage" });
  log.debug({ recordCount: records.length }, "Persisting usage records");

  const rows = prepareUsageRecordsForInsert(records, context, modelConfigs).map((row) => ({
    ...row,
    updatedAt: row.createdAt,
  }));

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await db.insert(llmUsage).values(rows);
      return;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        log.error({ err: error, attempts: MAX_RETRIES }, "Failed to persist usage after retries");
        throw error;
      }
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      log.warn({ attempt, delayMs: delay }, "Persist attempt failed, retrying");
      await sleep(delay);
    }
  }
}

// ============================================================================
// TRACE PERSISTENCE
// ============================================================================

/**
 * Serialize messages for JSONB storage.
 */
export function serializeMessages(messages: BaseMessage[]): SerializedMessage[] {
  return messages.map((msg) => ({
    type: msg._getType(),
    content: msg.content,
    name: (msg as any).name ?? undefined,
    id: msg.id ?? undefined,
    tool_calls: (msg as any).tool_calls ?? undefined,
    tool_call_id: (msg as any).tool_call_id ?? undefined,
    usage_metadata: (msg as any).usage_metadata ?? undefined,
    response_metadata: (msg as any).response_metadata ?? undefined,
    additional_kwargs: (msg as any).additional_kwargs ?? undefined,
    is_context_message: isContextMessage(msg),
  }));
}

/**
 * Persist a conversation trace to the database.
 * PostgreSQL automatically routes to the correct monthly partition.
 */
export async function persistTrace(
  context: TraceContext,
  messages: BaseMessage[],
  usageSummary: UsageSummary
): Promise<void> {
  if (messages.length === 0) return;

  const serializedMessages = serializeMessages(messages);

  // Extract system prompt for convenience column
  const systemMessage = messages.find((m) => m._getType() === "system");
  const systemPrompt = systemMessage
    ? typeof systemMessage.content === "string"
      ? systemMessage.content
      : JSON.stringify(systemMessage.content)
    : null;

  await db.insert(llmConversationTraces).values({
    chatId: context.chatId,
    threadId: context.threadId,
    runId: context.runId,
    graphName: context.graphName ?? null,
    messages: serializedMessages,
    systemPrompt,
    usageSummary,
    createdAt: new Date().toISOString(),
  });
}
