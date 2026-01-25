import type { BaseMessage } from "@langchain/core/messages";
import { generateUUID } from "@types";
import { usageStorage } from "./storage";
import type { UsageRecord, UsageContext } from "./types";

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
}> {
  const runId = generateUUID();
  const fullContext: UsageContext = {
    runId,
    records: [],
    messages: [],
    _seenMessageIds: new Set(),
    _lastInputMessageCount: 0,
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
    };
  });
}
