import { AsyncLocalStorage } from "node:async_hooks";
import { generateUUID } from "@types";
import type { UsageContext } from "./types";

export const usageStorage = new AsyncLocalStorage<UsageContext>();

/**
 * Get the current usage tracking context.
 * Returns undefined when called outside of runWithUsageTracking.
 */
export function getUsageContext(): UsageContext | undefined {
  return usageStorage.getStore();
}

/**
 * Create a fresh UsageContext for tracking.
 * Use with usageStorage.run() for custom tracking scenarios (e.g., streaming).
 */
export function createUsageContext(
  options: Partial<Omit<UsageContext, "runId">> = {}
): UsageContext {
  return {
    runId: generateUUID(),
    records: [],
    messages: [],
    _seenMessageIds: new Set(),
    _lastInputMessageCount: 0,
    ...options,
  };
}
