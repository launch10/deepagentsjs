/**
 * Fire-and-forget notification to Rails to trigger credit charging.
 *
 * Rails has a backup polling job that catches any missed notifications,
 * so this is best-effort. Failures are logged but don't block execution.
 */

const RAILS_BASE_URL = process.env.RAILS_URL || "http://localhost:3000";

/**
 * Build the notification URL for Rails.
 */
export function buildNotifyUrl(runId: string): string {
  const params = new URLSearchParams({ run_id: runId });
  return `${RAILS_BASE_URL}/api/v1/llm_usage/notify?${params.toString()}`;
}

/**
 * Notify Rails that usage records are ready to be charged.
 *
 * This is a fire-and-forget operation:
 * - Doesn't wait for response
 * - Doesn't throw on failure
 * - Logs warnings on failure for debugging
 *
 * Rails has a backup polling job (Credits::FindUnprocessedRunsWorker)
 * that catches any missed notifications.
 *
 * @param runId - The run ID to notify Rails about
 */
export async function notifyRails(runId: string): Promise<void> {
  const url = buildNotifyUrl(runId);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(
        `Failed to notify Rails: HTTP ${response.status}`,
        new Error(`HTTP ${response.status}`)
      );
    }
  } catch (error) {
    // Fire-and-forget: log warning but don't throw
    // Rails backup job will catch any missed notifications
    console.warn("Failed to notify Rails about usage:", error);
  }
}
