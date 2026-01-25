/**
 * Billing Core - Usage Tracking Primitives
 *
 * These are the core building blocks for billing/usage tracking.
 * They are used by middleware (in the SDK) to track LLM usage.
 *
 * Architecture:
 * - usageTracker: LLM callback handler that captures token usage
 * - usageStorage: AsyncLocalStorage for tracking context
 * - persistUsage/persistTrace: Database persistence
 * - notifyRails: Fire-and-forget notification to Rails
 *
 * Middleware uses these primitives via createStorageMiddleware:
 * @example
 * ```typescript
 * const usageMiddleware = createStorageMiddleware({
 *   storage: usageStorage,
 *   createContext: (ctx) => createUsageContext({ chatId, threadId, graphName }),
 *   onComplete: async (ctx, usageContext) => {
 *     await persistUsage(usageContext.records, { chatId, threadId, graphName });
 *     await persistTrace({ chatId, threadId, runId, graphName }, usageContext.messages, summary);
 *     notifyRails(usageContext.runId);
 *   },
 * });
 * ```
 */

// Core tracking primitives
export {
  usageTracker,
  usageStorage,
  getUsageContext,
  createUsageContext,
  type UsageRecord,
  type UsageContext,
} from "./usageTracker";

// Database persistence
export {
  persistTrace,
  serializeMessages,
  type TraceContext,
  type UsageSummary,
  type SerializedMessage,
} from "./persistTrace";

export {
  persistUsage,
  prepareUsageRecordsForInsert,
  type UsageContext as UsagePersistContext,
} from "./persistUsage";

// Rails notification
export { notifyRails, buildNotifyUrl } from "./notifyRails";

// Stream wrapper for non-Bridge routes (e.g., deploy)
// Use this when you can't use middleware-based tracking
export {
  streamWithUsageTracking,
  type StreamTrackingContext,
} from "./streamWithUsageTracking";
