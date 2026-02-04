import { RailsAPIBase } from "../index";
import type { Simplify } from "type-fest";

/**
 * Context event returned by the API
 */
export interface ContextEvent {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/**
 * Parameters for listing context events
 */
export interface ListContextEventsParams {
  project_id: number;
  event_types?: string[];
  since?: string;
}

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
  async list(params: ListContextEventsParams): Promise<ContextEvent[]> {
    const client = await this.getClient();

    // Build query parameters
    const searchParams: Record<string, string | string[]> = {
      project_id: String(params.project_id),
    };

    if (params.event_types?.length) {
      searchParams["event_types[]"] = params.event_types;
    }

    if (params.since) {
      searchParams.since = params.since;
    }

    const response = await client.GET("/api/v1/agent_context_events" as any, {
      params: { query: searchParams },
    });

    if (response.error) {
      throw new Error(`Failed to get context events: ${JSON.stringify(response.error)}`);
    }

    return (response.data ?? []) as ContextEvent[];
  }
}
