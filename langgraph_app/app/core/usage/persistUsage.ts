import { db, llmUsage } from "@db";
import type { UsageRecord } from "./types";

/**
 * Context for persisting usage records.
 */
export interface UsagePersistContext {
  chatId: number;
  threadId: string;
  graphName?: string;
}

/**
 * Prepare usage records for database insertion.
 * Transforms UsageRecord[] to the format expected by the llm_usage table.
 */
export function prepareUsageRecordsForInsert(
  records: UsageRecord[],
  context: UsagePersistContext
): Array<{
  chatId: number;
  threadId: string;
  runId: string;
  messageId: string;
  langchainRunId: string;
  parentLangchainRunId?: string;
  graphName?: string;
  modelRaw: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}> {
  return records.map((record) => ({
    chatId: context.chatId,
    threadId: context.threadId,
    runId: record.runId,
    messageId: record.messageId,
    langchainRunId: record.langchainRunId,
    parentLangchainRunId: record.parentLangchainRunId,
    graphName: context.graphName,
    modelRaw: record.model, // Schema uses modelRaw, not model
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    reasoningTokens: record.reasoningTokens,
    cacheCreationTokens: record.cacheCreationTokens,
    cacheReadTokens: record.cacheReadTokens,
    tags: record.tags,
    metadata: record.metadata,
    createdAt: record.timestamp.toISOString(),
  }));
}

/**
 * Persist usage records to the llm_usage table.
 *
 * @param records - Usage records from the usage tracker
 * @param context - Context with chatId, threadId, graphName
 */
export async function persistUsage(
  records: UsageRecord[],
  context: UsagePersistContext
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  const rows = prepareUsageRecordsForInsert(records, context);

  await db.insert(llmUsage).values(
    rows.map((row) => ({
      ...row,
      updatedAt: row.createdAt,
    }))
  );
}
