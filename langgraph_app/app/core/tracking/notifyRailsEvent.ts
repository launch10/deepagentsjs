/**
 * Rails Event Notification
 *
 * Fire-and-forget notification to create AppEvent records in Rails.
 * Uses internal service auth (HMAC signature without JWT).
 * Failures are logged but never block the caller.
 */
import { createRailsApiClient } from "@rails_api";
import { getLogger } from "../logger";

interface AppEventParams {
  eventName: string;
  userId?: number;
  projectId?: number;
  properties?: Record<string, unknown>;
}

export async function notifyRailsEvent(params: AppEventParams): Promise<void> {
  try {
    const client = await createRailsApiClient({ internalServiceCall: true });
    const response = await client.POST("/api/v1/app_events", {
      body: {
        event_name: params.eventName,
        user_id: params.userId,
        project_id: params.projectId,
        properties: params.properties || {},
      },
    });

    if (response.error) {
      getLogger({ component: "notifyRailsEvent" }).warn(
        { eventName: params.eventName, error: response.error },
        "Rails event notification error"
      );
    }
  } catch (error) {
    getLogger({ component: "notifyRailsEvent" }).warn(
      { eventName: params.eventName, err: error },
      "Rails event notification failed"
    );
  }
}
