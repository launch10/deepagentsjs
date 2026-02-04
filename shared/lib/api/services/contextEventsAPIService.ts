import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

/**
 * Type definitions derived from OpenAPI spec
 */

/** Full response type from GET /api/v1/agent_context_events */
export type ContextEventsListResponse = NonNullable<
  paths["/api/v1/agent_context_events"]["get"]["responses"][200]["content"]["application/json"]
>;

/** Single context event type */
export type ContextEvent = ContextEventsListResponse[number];

/** Request parameters for GET /api/v1/agent_context_events */
export type ListContextEventsParams = NonNullable<
  paths["/api/v1/agent_context_events"]["get"]["parameters"]["query"]
>;

/**
 * Service for interacting with the Rails Agent Context Events API
 * Used by Langgraph to fetch events that occurred outside of the conversation
 */
export class ContextEventsAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  /**
   * List context events for a project
   *
   * @param params.project_id - The project to fetch events for
   * @param params.event_types - Optional array of event types to filter by
   * @param params.since - Optional ISO8601 timestamp to filter events after
   * @returns Array of context events in chronological order
   */
  async list(params: ListContextEventsParams): Promise<ContextEventsListResponse> {
    const client = await this.getClient();

    const response = await client.GET("/api/v1/agent_context_events", {
      params: { query: params },
    });

    if (response.error) {
      throw new Error(`Failed to get context events: ${JSON.stringify(response.error)}`);
    }

    return response.data ?? [];
  }
}
