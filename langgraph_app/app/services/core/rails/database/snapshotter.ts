import { 
  RailsApiService, 
  type FieldMapper, 
  type SuccessResponse, 
  type ErrorResponse,
} from "../api";

interface RailsSnapshot {
    name: string,
    truncate_first: boolean
}

export interface SnapshotResponseType {
    name: string,
    truncateFirst: boolean
}

// BasicRailsApiService just has data passthrough instead of mapping internal/external
// representations. 
export class DatabaseSnapshotter extends RailsApiService<SnapshotResponseType, RailsSnapshot> {
    override resourceName() {
      return 'snapshot';
    }

    protected override getFieldMapper(): FieldMapper<SnapshotResponseType, RailsSnapshot> {
        return {
            name: 'name',
            truncateFirst: 'truncate_first'
        };
    }

    public async createSnapshot(name: string) {
      await this.post('test/database/snapshots', { name });
    }

    public async restoreSnapshot(name: string, truncateFirst: boolean = true) {
      await this.post('test/database/restore_snapshot', { name, truncateFirst });
    }

    public async truncate() {
      await this.post('test/database/truncate', {});
    }

    public async listSnapshots(): Promise<SuccessResponse<SnapshotResponseType[]> | ErrorResponse> {
      return this.index('test/database/snapshots', 'snapshots');
    }
}

export const databaseSnapshotter = new DatabaseSnapshotter();