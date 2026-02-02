/**
 * Database snapshot operations for E2E tests.
 *
 * This module handles ONLY database-level operations:
 * - Restore snapshots (baseline test state)
 * - Truncate database
 * - List available snapshots
 *
 * For test data scenarios, use appScenario() from e2e/support/on-rails.ts.
 * For test data queries, use appQuery() from e2e/support/on-rails.ts.
 *
 * @example
 * import { DatabaseSnapshotter } from './fixtures/database';
 * import { appScenario, appQuery } from './support/on-rails';
 *
 * test.beforeEach(async () => {
 *   await DatabaseSnapshotter.restoreSnapshot('basic_account');
 *   await appScenario('fill_subdomain_limit', { email: 'test@example.com' });
 *   const project = await appQuery<{ id: number; uuid: string }>('first_project');
 * });
 */

import { e2eConfig } from "../config";

const BASE_URL = e2eConfig.railsBaseUrl;

export interface DatabaseOperationResult {
  status: string;
  message: string;
}

/**
 * Database snapshot operations.
 * Use these to restore baseline test state.
 */
export const DatabaseSnapshotter = {
  /**
   * Restores the database from a snapshot.
   * Snapshots are SQL dumps in test/fixtures/database/snapshots/.
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
   * Truncates all tables in the database.
   */
  async truncate(): Promise<DatabaseOperationResult> {
    const response = await fetch(`${BASE_URL}/test/database/truncate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to truncate database: ${response.status} - ${error}`
      );
    }

    return response.json();
  },

  /**
   * Lists all available database snapshots.
   */
  async listSnapshots(): Promise<string[]> {
    const response = await fetch(`${BASE_URL}/test/database/snapshots`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list snapshots: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.snapshots;
  },
};
