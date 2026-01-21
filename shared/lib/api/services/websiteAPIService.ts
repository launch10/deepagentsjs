import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

// ============================================================================
// Type Definitions
// ============================================================================

export type GetWebsiteResponse = NonNullable<
  paths["/api/v1/websites/{id}"]["get"]["responses"][200]["content"]["application/json"]
>;

export type UpdateWebsiteRequest = NonNullable<
  paths["/api/v1/websites/{id}"]["patch"]["requestBody"]
>["content"]["application/json"];

export type UpdateWebsiteResponse = NonNullable<
  paths["/api/v1/websites/{id}"]["patch"]["responses"][200]["content"]["application/json"]
>;

// ============================================================================
// Service Class
// ============================================================================

/**
 * Service for interacting with the Rails Website API
 */
export class WebsiteAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  async get(websiteId: number): Promise<GetWebsiteResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/websites/{id}", {
      params: {
        path: { id: websiteId },
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
    websiteId: number,
    website: UpdateWebsiteRequest["website"]
  ): Promise<UpdateWebsiteResponse> {
    const client = await this.getClient();
    const response = await client.PATCH("/api/v1/websites/{id}", {
      params: {
        path: { id: websiteId },
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

// Re-export with old name for backwards compatibility during migration
export { WebsiteAPIService as WebsiteService };
