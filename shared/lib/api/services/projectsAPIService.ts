import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

/**
 * Type definitions for project operations
 */
export type GetProjectsRequest = {
  page?: number;
  status?: "draft" | "paused" | "live";
};

export type GetProjectsResponse = NonNullable<
  paths["/api/v1/projects"]["get"]["responses"][200]["content"]["application/json"]
>;

/** Project type matching the mini JSON response */
export interface ProjectMini {
  id: number;
  uuid: string;
  website_id: number | null;
  account_id: number;
  name: string;
  status: "draft" | "paused" | "live";
  domain: string | null;
  created_at: string;
  updated_at: string;
}

/** Pagination metadata */
export interface PaginationMeta {
  current_page: number;
  total_pages: number;
  total_count: number;
  prev_page: number | null;
  next_page: number | null;
  from: number | null;
  to: number | null;
  series: (number | string)[];
}

/** Full response type with projects and pagination */
export interface ProjectsListResponse {
  projects: ProjectMini[];
  pagination: PaginationMeta;
}

/**
 * Service for interacting with the Rails Projects API
 * Can be used from both frontend and backend (langgraph)
 */
export class ProjectsAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  /**
   * Get paginated projects for the authenticated user's account
   * @param params - Optional query parameters (page, status filter)
   * @returns Paginated list of projects with pagination metadata
   */
  async get(params?: GetProjectsRequest): Promise<ProjectsListResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/projects", {
      params: {
        query: params,
      },
    });

    if (response.response.status !== 200) {
      throw new Error(
        `Failed to get projects: ${response.response.status} ${response.response.statusText}`
      );
    }

    if (response.error) {
      throw new Error(`Failed to get projects: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to get projects: No data returned`);
    }

    return response.data as ProjectsListResponse;
  }
}
