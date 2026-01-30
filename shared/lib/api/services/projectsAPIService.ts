import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

/**
 * Type definitions derived from OpenAPI spec
 */

/** Full response type from GET /api/v1/projects */
export type ProjectsListResponse = NonNullable<
  paths["/api/v1/projects"]["get"]["responses"][200]["content"]["application/json"]
>;

/** Project type matching the mini JSON response */
export type ProjectMini = ProjectsListResponse["projects"][number];

/** Pagination metadata */
export type PaginationMeta = ProjectsListResponse["pagination"];

/** Status counts for filter badges */
export type StatusCounts = ProjectsListResponse["status_counts"];

/** Request parameters for GET /api/v1/projects */
export type GetProjectsRequest = NonNullable<
  paths["/api/v1/projects"]["get"]["parameters"]["query"]
>;

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

    return response.data;
  }

  /**
   * Delete a project by UUID
   * @param uuid - The project UUID to delete
   */
  async delete(uuid: string): Promise<void> {
    const client = await this.getClient();
    const response = await client.DELETE("/api/v1/projects/{uuid}", {
      params: {
        path: { uuid },
      },
    });

    if (response.response.status !== 204) {
      throw new Error(
        `Failed to delete project: ${response.response.status} ${response.response.statusText}`
      );
    }
  }
}
