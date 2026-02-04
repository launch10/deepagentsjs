/**
 * Context Engineering
 *
 * Enables agents to be aware of changes that happened outside of the conversation.
 *
 * Use `injectAgentContext` from within nodes to add context messages.
 * The stream middleware approach is deprecated (breaks AsyncLocalStorage).
 */
export { injectAgentContext } from "./injectAgentContext";
export { AGENT_EVENT_SUBSCRIPTIONS, getSubscribedEventTypes } from "./subscriptions";
export { summarizeEvents, type SummarizedEvent } from "./summarization";
