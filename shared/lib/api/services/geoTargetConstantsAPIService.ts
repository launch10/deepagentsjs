import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

export type SearchGeoTargetConstantsRequest = NonNullable<
  paths["/api/v1/geo_target_constants"]["get"]["parameters"]["query"]
>;
export type SearchGeoTargetConstantsResponse = NonNullable<
  paths["/api/v1/geo_target_constants"]["get"]["responses"][200]["content"]["application/json"]
>;

/**
 * Service for interacting with the Rails Geo Target Constants API
 */
export class GeoTargetConstantsAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  async search(
    options: SearchGeoTargetConstantsRequest
  ): Promise<SearchGeoTargetConstantsResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/geo_target_constants", {
      params: {
        query: { location_query: options.location_query },
      },
    });

    if (response.error) {
      throw new Error(`Failed to search geo target constants: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to search geo target constants: no data returned`);
    }

    return response.data satisfies SearchGeoTargetConstantsResponse;
  }
}

// Re-export with old name for backwards compatibility during migration
export { GeoTargetConstantsAPIService as GeoTargetConstantsService };
