import { db, deploys, eq } from "@db";

/**
 * Direct database operations for deploys.
 * Uses Drizzle to write directly to the database, avoiding HTTP round-trips to Rails.
 */
export class DeployService {
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
