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

// Cost calculation (for predictive credit status)
export { calculateCost, calculateRunCost } from "./costCalculator";

// Credit check (pre-run balance check)
export {
  checkCredits,
  canProceedWithRun,
  CreditCheckError,
  type CreditCheckResult,
} from "./creditCheck";

// Credit status (post-run derivation)
export { deriveCreditStatus, type CreditStatus, type CreditStatusInput } from "./creditStatus";
