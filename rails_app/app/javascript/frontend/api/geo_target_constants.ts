import { RailsAPIBase, type paths } from "@rails_api";
import { type Simplify } from "type-fest";

export type SearchGeoTargetConstantsRequest = NonNullable<
  paths["/api/v1/geo_target_constants"]["get"]["parameters"]["query"]
>;
export type SearchGeoTargetConstantsResponse = NonNullable<
  paths["/api/v1/geo_target_constants"]["get"]["responses"][200]["content"]["application/json"]
>;

export class GeoTargetConstantsService extends RailsAPIBase {
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
