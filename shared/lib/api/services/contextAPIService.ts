import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

export type GetContextRequest = NonNullable<
  paths["/api/v1/websites/{website_id}/context"]["get"]["parameters"]["path"]
>;

export type GetContextResponse = NonNullable<
  paths["/api/v1/websites/{website_id}/context"]["get"]["responses"][200]["content"]["application/json"]
>;

/**
 * Service for fetching website context (brainstorm, uploads, theme) from Rails API
 */
export class ContextAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  async get(websiteId: number): Promise<GetContextResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/websites/{website_id}/context", {
      params: { path: { website_id: websiteId } },
    });

    if (response.error) {
      throw new Error(`Failed to get context: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to get context: No data returned");
    }

    return response.data satisfies GetContextResponse;
  }
}
