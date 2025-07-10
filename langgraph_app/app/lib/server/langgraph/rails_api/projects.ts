import { railsApiService } from '@services/railsApiService';
import type { FileData } from '@shared/models/file';
import type { FileMap } from '@shared/models/file';

interface ProjectApiResponse {
    id: string;
    name: string;
    thread_id: string;
    theme_id?: number;
    files?: FileData[];
}

interface CreateProjectRequest {
    project: {
        name: string;
        thread_id: string;
        theme_id?: number;
        files_attributes?: Array<{
            path: string;
            content: string;
            file_specification_id?: number;
        }>;
    };
}

interface UpdateProjectRequest {
    project: {
        name?: string;
        thread_id?: string;
        theme_id?: number;
        files_attributes?: Array<{
            path: string;
            content: string;
            file_specification_id?: number;
        }>;
    };
}

export class ProjectsApi {
    async getProject(projectId: string, jwt: string) {
        return railsApiService.get<ProjectApiResponse>(`projects/${projectId}`, jwt);
    }

    async getProjectFiles(projectId: string, jwt: string): Promise<FileMap> {
        const apiResponse = await railsApiService.get<FileData[]>(`projects/${projectId}/files`, jwt);

        if (!apiResponse.success || !apiResponse.data) {
            throw new Error(`Failed to get project files: ${apiResponse.error?.message}`);
        }

        debugger;
        // Returns to_mini_json from file_serialization.rb
        const fileMap: FileMap = apiResponse.data.reduce((acc, file) => {
            acc[file.path] = {
                path: file.path,
                content: file.content,
                fileSpecificationId: file.file_specification_id
            };
            return acc;
        }, {} as FileMap);

        return fileMap;
    }

    async createProject(data: CreateProjectRequest, jwt: string) {
        return railsApiService.post<ProjectApiResponse>('projects', data, jwt);
    }

    async updateProject(projectId: string, data: UpdateProjectRequest, jwt: string) {
        return railsApiService.put<ProjectApiResponse>(`projects/${projectId}`, data, jwt);
    }

    async deleteProject(projectId: string, jwt: string) {
        return railsApiService.delete(`projects/${projectId}`, jwt);
    }
}

export const projectsApi = new ProjectsApi();