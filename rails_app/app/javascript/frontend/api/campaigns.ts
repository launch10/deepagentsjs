import { RailsAPIBase, type paths } from "@rails_api";
import { type Simplify } from "type-fest";

export type AdvanceCampaignRequest = NonNullable<paths["/api/v1/campaigns/{id}/advance"]["post"]["parameters"]["path"]>;
export type AdvanceCampaignResponse = NonNullable<paths["/api/v1/campaigns/{id}/advance"]["post"]["responses"][200]["content"]["application/json"]>;

export class CampaignService extends RailsAPIBase {
    constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
        super(options)
    }

    async advance(options: AdvanceCampaignRequest): Promise<AdvanceCampaignResponse> {
        const response = await this.client.POST("/api/v1/campaigns/{id}/advance", {
            params: {
                path: { id: options.id },
            },
        });

        if (response.error) {
            throw new Error(`Failed to advance campaign: ${JSON.stringify(response.error)}`);
        }

        return response.data satisfies AdvanceCampaignResponse;
    }
}
