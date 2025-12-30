import { RailsAPIBase, type paths } from "@rails_api_base";
import type { Simplify } from "type-fest";

// ============================================================================
// Type Definitions
// ============================================================================

export type GetWebsiteResponse = NonNullable<
  paths["/api/v1/projects/{project_uuid}/website"]["get"]["responses"][200]["content"]["application/json"]
>;

export type UpdateWebsiteRequest = NonNullable<
  paths["/api/v1/projects/{project_uuid}/website"]["patch"]["requestBody"]
>["content"]["application/json"];

export type UpdateWebsiteResponse = NonNullable<
  paths["/api/v1/projects/{project_uuid}/website"]["patch"]["responses"][200]["content"]["application/json"]
>;

// ============================================================================
// Service Class
// ============================================================================

export class WebsiteService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  async get(projectUuid: string): Promise<GetWebsiteResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/projects/{project_uuid}/website", {
      params: {
        path: { project_uuid: projectUuid },
      },
    });

    if (response.error) {
      throw new Error(`Failed to get website: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to get website: No data returned");
    }

    return response.data satisfies GetWebsiteResponse;
  }

  async update(
    projectUuid: string,
    website: UpdateWebsiteRequest["website"]
  ): Promise<UpdateWebsiteResponse> {
    const client = await this.getClient();
    const response = await client.PATCH("/api/v1/projects/{project_uuid}/website", {
      params: {
        path: { project_uuid: projectUuid },
      },
      body: { website },
    });

    if (response.error) {
      throw new Error(`Failed to update website: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to update website: No data returned");
    }

    return response.data satisfies UpdateWebsiteResponse;
  }
}
