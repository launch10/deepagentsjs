import { RailsAPIBase, type paths } from "@rails_api";
import type { Simplify } from "type-fest";

/**
 * Type definitions for test database operations
 */
export type TruncateDatabaseResponse = NonNullable<
  paths["/test/database/truncate"]["post"]["responses"][200]["content"]
>["application/json"];

export type ListSnapshotsResponse = NonNullable<
  paths["/test/database/snapshots"]["get"]["responses"][200]["content"]
>["application/json"];

export type CreateSnapshotRequest = NonNullable<
  paths["/test/database/snapshots"]["post"]["requestBody"]
>["content"]["application/json"];

export type CreateSnapshotResponse = NonNullable<
  paths["/test/database/snapshots"]["post"]["responses"][201]["content"]
>["application/json"];

export type RestoreSnapshotRequest = NonNullable<
  paths["/test/database/restore_snapshot"]["post"]["requestBody"]
>["content"]["application/json"];

export type RestoreSnapshotResponse = NonNullable<
  paths["/test/database/restore_snapshot"]["post"]["responses"][200]["content"]
>["application/json"];

export interface DatabaseOperationResult {
  status: string;
  message: string;
}

/**
 * Service for interacting with the Rails Test Database API
 */
export class DatabaseSnapshotterAPI extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  /**
   * Truncates all tables in the database
   * @returns Operation result with status and message
   */
  async truncate(): Promise<DatabaseOperationResult> {
    const client = await this.getClient();
    const response = await client.POST("/test/database/truncate", {});

    if (response.error?.errors) {
      throw new Error(`Failed to truncate database: ${response.error.errors.join(", ")}`);
    }

    if (!response.data) {
      throw new Error(`Failed to truncate database: no data returned`);
    }

    return response.data satisfies DatabaseOperationResult;
  }

  /**
   * Lists all available database snapshots
   * @returns Array of snapshot names
   */
  async listSnapshots(): Promise<string[]> {
    const client = await this.getClient();
    const response = await client.GET("/test/database/snapshots", {});

    if (!response.data) {
      throw new Error(`Failed to list snapshots: no data returned`);
    }

    return response.data.snapshots;
  }

  /**
   * Creates a new database snapshot
   * @param name - Name for the snapshot (without .sql extension)
   * @param truncateFirst - Whether to truncate the database before creating snapshot
   * @returns Operation result with status and message
   */
  async createSnapshot(
    name: string,
    truncateFirst: boolean = false
  ): Promise<DatabaseOperationResult> {
    const client = await this.getClient();
    const response = await client.POST("/test/database/snapshots", {
      body: {
        snapshot: {
          name,
          truncate_first: truncateFirst,
        },
      },
    });

    if (response.error) {
      throw new Error(`Failed to create snapshot: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to create snapshot: no data returned`);
    }

    return response.data satisfies DatabaseOperationResult;
  }

  /**
   * Restores the database from a snapshot
   * @param name - Name of the snapshot to restore (without .sql extension)
   * @param truncateFirst - Whether to truncate the database before restoring
   * @returns Operation result with status and message
   */
  async restoreSnapshot(
    name: string,
    truncateFirst: boolean = true
  ): Promise<DatabaseOperationResult> {
    const client = await this.getClient();
    const response = await client.POST("/test/database/restore_snapshot", {
      body: {
        snapshot: {
          name,
          truncate_first: truncateFirst,
        },
      },
    });

    if (response.error) {
      throw new Error(`Failed to restore snapshot: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to restore snapshot: no data returned`);
    }

    return response.data satisfies DatabaseOperationResult;
  }
}

export const DatabaseSnapshotter = new DatabaseSnapshotterAPI({
  jwt: "test-jwt",
});
