/**
 * Conversation Management
 *
 * Pure conversation model (parse, window, compact, prepareTurn) and
 * the orchestration layer that adds Rails event fetching on top.
 */
export {
  Conversation,
  type Turn,
  type CompactOptions,
  type CompactResult,
  type PrepareTurnOptions,
} from "./conversation";

export { prepareTurn, fetchContextMessages, findLastAiMessageTime } from "./prepareTurn";
export type { PrepareTurnParams } from "./prepareTurn";

export { AGENT_EVENT_SUBSCRIPTIONS, getSubscribedEventTypes, type SubscribableGraph } from "./subscriptions";
export { summarizeEvents, type SummarizedEvent } from "./summarization";
