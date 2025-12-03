import { RailsAPIBase, type paths } from "@rails_api";
import type { UUIDType, PrimaryKeyType } from "@types";
import type { Simplify } from "type-fest";

export type CreateCampaignRequest = NonNullable<
  paths["/api/v1/campaigns"]["post"]["requestBody"]
>["content"]["application/json"];

export type CreateCampaignResponse = NonNullable<
  paths["/api/v1/campaigns"]["post"]["responses"][201]["content"]
>["application/json"];

export interface Campaign {
  id: number;
  name: string;
  project_id: number;
  website_id: number;
  account_id: number;
  thread_id: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignServiceOptions {
  jwt: string;
}

export interface CreateCampaignParams {
  name: string;
  projectId: PrimaryKeyType;
}

export class CampaignAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  async create({ name, projectId }: CreateCampaignParams): Promise<Campaign> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/campaigns", {
      body: {
        campaign: {
          name,
          project_id: projectId,
        } as any,
      },
    });

    if (response.error) {
      throw new Error(`Failed to create campaign: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to create campaign: no data returned`);
    }

    return response.data as Campaign;
  }
}
