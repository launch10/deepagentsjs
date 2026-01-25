/**
 * Rails Notification
 *
 * Fire-and-forget notification to trigger credit charging.
 * Rails has a backup polling job, so failures are logged but don't block.
 */

const RAILS_BASE_URL = process.env.RAILS_URL || "http://localhost:3000";
const NOTIFY_URL = `${RAILS_BASE_URL}/api/v1/llm_usage/notify`;

/**
 * Notify Rails that usage records are ready to be charged.
 * Fire-and-forget: doesn't wait, doesn't throw.
 */
export async function notifyRails(runId: string): Promise<void> {
  try {
    const response = await fetch(NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId }),
    });

    if (!response.ok) {
      console.warn(`[notifyRails] HTTP ${response.status} for runId ${runId}`);
    }
  } catch (error) {
    console.warn(`[notifyRails] Failed for runId ${runId}:`, error);
  }
}
