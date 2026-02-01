import { RailsAPIBase, type paths } from "../index";
import type { Options } from "../railsApiBase";
import type { Simplify } from "type-fest";

// ============================================================================
// Type Definitions
// ============================================================================

export type SearchWebsiteUrlsRequest = NonNullable<
  paths["/api/v1/website_urls/search"]["post"]["requestBody"]
>["content"]["application/json"];

export type SearchWebsiteUrlsResponse = NonNullable<
  paths["/api/v1/website_urls/search"]["post"]["responses"][200]["content"]["application/json"]
>;

// ============================================================================
// Service Class
// ============================================================================

/**
 * Service for interacting with the Rails Website URLs API
 */
export class WebsiteUrlsAPIService extends RailsAPIBase {
  constructor(options: Simplify<Options>) {
    super(options);
  }

  /**
   * Search for path availability on a specific domain
   * Checks if the given path candidates are available on the domain
   */
  async search(domainId: number, candidates: string[]): Promise<SearchWebsiteUrlsResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/website_urls/search", {
      body: { domain_id: domainId, candidates },
    });

    if (response.error) {
      throw new Error(`Failed to search website URLs: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to search website URLs: No data returned");
    }

    return response.data satisfies SearchWebsiteUrlsResponse;
  }
}
