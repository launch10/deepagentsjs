import { db, deploys, eq } from "@db";

/**
 * Direct database operations for deploys.
 * Uses Drizzle to write directly to the database, avoiding HTTP round-trips to Rails.
 */
export class DeployService {
  /**
   * Persists the langgraph thread ID to the deploy record.
   * Called immediately when a deploy stream starts to ensure the frontend
   * can reconnect to the same thread after a page refresh.
   *
   * @param deployId - The ID of the deploy
   * @param threadId - The langgraph thread ID to persist
   */
  static async saveThreadId(deployId: number, threadId: string): Promise<void> {
    await db
      .update(deploys)
      .set({
        langgraphThreadId: threadId,
        status: "running",
        userActiveAt: new Date().toISOString(),
      })
      .where(eq(deploys.id, deployId));
  }

  /**
   * Updates the user_active_at timestamp for a deploy.
   * Called when the user is actively viewing the deploy page or
   * when the langgraph process is waiting on user action.
   *
   * This writes directly to the database instead of going through the Rails API,
   * which is faster and more reliable.
   *
   * @param deployId - The ID of the deploy to touch
   */
  static async touch(deployId: number): Promise<void> {
    const now = new Date().toISOString();

    await db.update(deploys).set({ userActiveAt: now }).where(eq(deploys.id, deployId));
  }
}
