/**
 * Billing Module
 *
 * This module handles Rails notification for credit charging.
 * Usage tracking and tracing have been moved to their own modules.
 *
 * For new code, import directly from the specific modules:
 * - Usage tracking: import from "@core/usage" or "@core"
 * - Tracing: import from "@core/tracing" or "@core"
 * - Billing notification: import from "@core/billing" or "@core"
 */

// Core billing functionality
export { notifyRails, buildNotifyUrl } from "./notifyRails";

// Re-export from usage module for backwards compatibility
export {
  usageTracker,
  usageStorage,
  getUsageContext,
  createUsageContext,
  persistUsage,
  prepareUsageRecordsForInsert,
  type UsageRecord,
  type UsageContext,
  type UsagePersistContext,
} from "../usage";

// Re-export from tracing module for backwards compatibility
export {
  persistTrace,
  serializeMessages,
  type TraceContext,
  type UsageSummary,
  type SerializedMessage,
} from "../tracing";

// Stream wrapper for non-Bridge routes (e.g., deploy)
// Use this when you can't use middleware-based tracking
export {
  streamWithUsageTracking,
  type StreamTrackingContext,
} from "./streamWithUsageTracking";
