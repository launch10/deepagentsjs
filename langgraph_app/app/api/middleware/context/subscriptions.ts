/**
 * Agent Subscriptions
 *
 * Defines which event types each graph subscribes to.
 * Events not in a graph's subscription list won't be fetched.
 */

export const AGENT_EVENT_SUBSCRIPTIONS: Record<string, string[]> = {
  website: ["images.created", "images.deleted"],
  brainstorm: [],
  ads: [],
  insights: [],
  deploy: [],
  router: [],
};

/**
 * Get the event types a graph subscribes to.
 * Returns empty array for unknown graphs.
 */
export function getSubscribedEventTypes(graphName: string | undefined): string[] {
  if (!graphName) return [];
  return AGENT_EVENT_SUBSCRIPTIONS[graphName] ?? [];
}
