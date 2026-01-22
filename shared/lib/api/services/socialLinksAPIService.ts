import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

// ============================================================================
// Type Definitions
// ============================================================================

export type GetSocialLinksResponse = NonNullable<
  paths["/api/v1/projects/{project_id}/social_links"]["get"]["responses"][200]["content"]["application/json"]
>;

export type BulkUpsertSocialLinksRequest = NonNullable<
  paths["/api/v1/projects/{project_id}/social_links/bulk_upsert"]["post"]["requestBody"]
>["content"]["application/json"];

export type BulkUpsertSocialLinksResponse = NonNullable<
  paths["/api/v1/projects/{project_id}/social_links/bulk_upsert"]["post"]["responses"][200]["content"]["application/json"]
>;

export type SocialLink = GetSocialLinksResponse[number];

// ============================================================================
// Service Class
// ============================================================================

/**
 * Service for interacting with the Rails Social Links API
 */
export class SocialLinksAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  async get(projectId: number): Promise<GetSocialLinksResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/projects/{project_id}/social_links", {
      params: {
        path: { project_id: projectId },
      },
    });

    if (response.error) {
      throw new Error(`Failed to get social links: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to get social links: No data returned");
    }

    return response.data satisfies GetSocialLinksResponse;
  }

  async bulkUpsert(
    projectId: number,
    socialLinks: BulkUpsertSocialLinksRequest["social_links"]
  ): Promise<BulkUpsertSocialLinksResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/projects/{project_id}/social_links/bulk_upsert", {
      params: {
        path: { project_id: projectId },
      },
      body: { social_links: socialLinks },
    });

    if (response.error) {
      throw new Error(`Failed to save social links: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to save social links: No data returned");
    }

    return response.data satisfies BulkUpsertSocialLinksResponse;
  }

  async delete(projectId: number, socialLinkId: number): Promise<void> {
    const client = await this.getClient();
    const response = await client.DELETE("/api/v1/projects/{project_id}/social_links/{id}", {
      params: {
        path: { project_id: projectId, id: socialLinkId },
      },
    });

    if (response.error) {
      throw new Error(`Failed to delete social link: ${JSON.stringify(response.error)}`);
    }
  }
}

// Re-export with old name for backwards compatibility during migration
export { SocialLinksAPIService as SocialLinksService };
