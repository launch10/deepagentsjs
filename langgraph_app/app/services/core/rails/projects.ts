import { RailsApiService, type FieldMapper, type SuccessResponse, type ErrorResponse } from './api';
export interface RailsProject {
    id: number;
    name: string;
    thread_id: string;
    website_id: number;
    account_id: number;
    created_at?: string;
    updated_at?: string;
}

export interface ProjectResponseType {
    id: number;
    name: string;
    threadId: string;
    websiteId: number;
    accountId: number;
    createdAt?: string;
    updatedAt?: string;
}
export class ProjectsApiService extends RailsApiService<ProjectResponseType, RailsProject> {
    override resourceName() {
        return 'project';
    }

    protected override getFieldMapper(): FieldMapper<ProjectResponseType, RailsProject> {
        return {
            id: 'id',
            name: 'name',
            threadId: 'thread_id',
            websiteId: 'website_id',
            accountId: 'account_id',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        } as FieldMapper<ProjectResponseType, RailsProject>;
    }

    /**
     * Create a new project
     */
    async createProject(project: Partial<ProjectResponseType>, jwt?: string): Promise<SuccessResponse<ProjectResponseType> | ErrorResponse> {
        return this.post('projects', project, jwt);
    }
}

// Export singleton instance
export const projectsApi = new ProjectsApiService();