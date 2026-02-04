/**
 * Agent Context Event Types
 *
 * Defines the allowed event types for the AgentContextEvent system.
 * These are shared between Rails (validation) and Langgraph (subscriptions).
 */

// Website graph subscribes to image events
export const WEBSITE_EVENT_TYPES = ["images.created", "images.deleted"] as const;
export type WebsiteEventType = (typeof WEBSITE_EVENT_TYPES)[number];

// Future: Add event types for other graphs as needed
// export const BRAINSTORM_EVENT_TYPES = [] as const;
// export const ADS_EVENT_TYPES = [] as const;

// All valid event types (union of all graph-specific types)
export const ALL_EVENT_TYPES = [...WEBSITE_EVENT_TYPES] as const;
export type AgentContextEventType = (typeof ALL_EVENT_TYPES)[number];

// Graph names that can subscribe to events
export const SUBSCRIBABLE_GRAPHS = [
  "website",
  "brainstorm",
  "ads",
  "insights",
  "deploy",
  "router",
] as const;
export type SubscribableGraph = (typeof SUBSCRIBABLE_GRAPHS)[number];

// Maps graphs to their subscribed event types
export const agentEventSubscriptions: Record<SubscribableGraph, readonly AgentContextEventType[]> = {
  website: WEBSITE_EVENT_TYPES,
  brainstorm: [],
  ads: [],
  insights: [],
  deploy: [],
  router: [],
} as const;

/**
 * Get the event types a graph subscribes to.
 * Returns empty array for unknown graphs.
 */
export function getSubscribedEventTypes(graphName: string | undefined): readonly AgentContextEventType[] {
  if (!graphName) return [];
  return agentEventSubscriptions[graphName as SubscribableGraph] ?? [];
}

/**
 * Check if an event type is valid.
 */
export function isValidEventType(eventType: string): eventType is AgentContextEventType {
  return ALL_EVENT_TYPES.includes(eventType as AgentContextEventType);
}
