import { RailsAPIBase, type paths } from "@rails_api_base";
import type { Simplify } from "type-fest";

// ============================================================================
// Type Definitions
// ============================================================================

export type GetSocialLinksResponse = NonNullable<
  paths["/api/v1/projects/{project_uuid}/social_links"]["get"]["responses"][200]["content"]["application/json"]
>;

export type BulkUpsertSocialLinksRequest = NonNullable<
  paths["/api/v1/projects/{project_uuid}/social_links/bulk_upsert"]["post"]["requestBody"]
>["content"]["application/json"];

export type BulkUpsertSocialLinksResponse = NonNullable<
  paths["/api/v1/projects/{project_uuid}/social_links/bulk_upsert"]["post"]["responses"][200]["content"]["application/json"]
>;

export type SocialLink = GetSocialLinksResponse[number];

// ============================================================================
// Service Class
// ============================================================================

export class SocialLinksService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  async get(projectUuid: string): Promise<GetSocialLinksResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/projects/{project_uuid}/social_links", {
      params: {
        path: { project_uuid: projectUuid },
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
    projectUuid: string,
    socialLinks: BulkUpsertSocialLinksRequest["social_links"]
  ): Promise<BulkUpsertSocialLinksResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/projects/{project_uuid}/social_links/bulk_upsert", {
      params: {
        path: { project_uuid: projectUuid },
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
}
