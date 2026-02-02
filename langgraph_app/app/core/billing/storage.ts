/**
 * Usage Context Storage
 *
 * AsyncLocalStorage for propagating usage context through LangChain callbacks.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { generateUUID } from "@types";
import type { UsageContext } from "./types";

export const usageStorage = new AsyncLocalStorage<UsageContext>();

/**
 * Get the current usage tracking context.
 * Returns undefined when called outside of a tracked stream.
 */
export function getUsageContext(): UsageContext | undefined {
  return usageStorage.getStore();
}

/**
 * Create a fresh UsageContext for tracking.
 */
export function createUsageContext(
  options: Partial<Omit<UsageContext, "runId">> = {}
): UsageContext {
  return {
    runId: generateUUID(),
    records: [],
    messages: [],
    _seenMessageIds: new Set(),
    _runIdToMetadata: new Map(),
    ...options,
  };
}
