/**
 * Billing Module
 *
 * Usage tracking, trace persistence, and Rails notification.
 * All LLM token tracking flows through here.
 */

// Types
export type {
  UsageRecord,
  UsageContext,
  UsagePersistContext,
  TraceContext,
  UsageSummary,
  SerializedMessage,
} from "./types";

// Storage (AsyncLocalStorage)
export { usageStorage, getUsageContext, createUsageContext } from "./storage";

// Callback handler (attached to LLMs via getLLM)
export { usageTracker } from "./tracker";

// Persistence
export {
  persistUsage,
  persistTrace,
  serializeMessages,
  prepareUsageRecordsForInsert,
} from "./persist";

// Rails notification
export { notifyRails } from "./notifyRails";
