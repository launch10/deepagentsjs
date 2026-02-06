/**
 * Rails Notification
 *
 * Fire-and-forget notification to trigger credit charging.
 * Uses internal service auth (HMAC signature without JWT).
 * Rails has a backup polling job, so failures are logged but don't block.
 */
import { createRailsApiClient } from "@rails_api";
import { getLogger } from "../logger";

/**
 * Notify Rails that usage records are ready to be charged.
 * Fire-and-forget: doesn't wait, doesn't throw.
 */
export async function notifyRails(runId: string): Promise<void> {
  try {
    const client = await createRailsApiClient({ internalServiceCall: true });
    // TODO: Add rswag specs to Rails controller so this endpoint is in generated types
    const response = await client.POST("/api/v1/llm_usage/notify" as any, {
      body: { run_id: runId },
    });

    if (response.error) {
      getLogger({ component: "notifyRails" }).warn({ runId, error: response.error }, "Rails notification error");
    }
  } catch (error) {
    getLogger({ component: "notifyRails" }).warn({ runId, err: error }, "Rails notification failed");
  }
}
