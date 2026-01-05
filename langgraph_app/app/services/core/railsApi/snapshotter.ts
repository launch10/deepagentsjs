/**
 * Re-export from shared package for backwards compatibility.
 * The actual implementation lives in shared/lib/api/snapshotter.ts
 */
export {
  DatabaseSnapshotterAPI,
  DatabaseSnapshotter,
  type DatabaseOperationResult,
  type TruncateDatabaseResponse,
  type ListSnapshotsResponse,
  type CreateSnapshotRequest,
  type CreateSnapshotResponse,
  type RestoreSnapshotRequest,
  type RestoreSnapshotResponse,
} from "@rails_api";
