/**
 * Database utilities for E2E tests.
 * Mirrors the pattern from langgraph_app/app/services/core/railsApi/snapshotter.ts
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export interface DatabaseOperationResult {
  status: string;
  message: string;
}

/**
 * Service for interacting with the Rails Test Database API.
 * Used in beforeEach hooks to restore database to known state.
 *
 * @example
 * test.beforeEach(async ({ page }) => {
 *   await DatabaseSnapshotter.restoreSnapshot("basic_account");
 *   await loginUser(page);
 * });
 */
export const DatabaseSnapshotter = {
  /**
   * Restores the database from a snapshot
   * @param name - Name of the snapshot to restore (without .sql extension)
   * @param truncateFirst - Whether to truncate the database before restoring
   */
  async restoreSnapshot(
    name: string,
    truncateFirst: boolean = true
  ): Promise<DatabaseOperationResult> {
    const response = await fetch(`${BASE_URL}/test/database/restore_snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshot: { name, truncate_first: truncateFirst },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to restore snapshot '${name}': ${response.status} - ${error}`
      );
    }

    return response.json();
  },

  /**
   * Truncates all tables in the database
   */
  async truncate(): Promise<DatabaseOperationResult> {
    const response = await fetch(`${BASE_URL}/test/database/truncate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to truncate database: ${response.status} - ${error}`);
    }

    return response.json();
  },

  /**
   * Lists all available database snapshots
   */
  async listSnapshots(): Promise<string[]> {
    const response = await fetch(`${BASE_URL}/test/database/snapshots`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list snapshots: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.snapshots;
  },
};
