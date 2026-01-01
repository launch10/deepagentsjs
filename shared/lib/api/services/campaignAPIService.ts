import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

// ============================================================================
// Type Definitions - Request Types
// ============================================================================

/** Request parameters for creating a campaign */
export type CreateCampaignRequest = NonNullable<
  paths["/api/v1/campaigns"]["post"]["requestBody"]
>["content"]["application/json"];

/** Request body for updating a campaign (autosave) */
export type UpdateCampaignRequestBody = NonNullable<
  paths["/api/v1/campaigns/{id}"]["patch"]["requestBody"]
>["content"]["application/json"];

/** Request parameters for advance campaign (path params) */
export type AdvanceCampaignRequest = NonNullable<
  paths["/api/v1/campaigns/{id}/advance"]["post"]["parameters"]["path"]
>;

/** Request parameters for back campaign (path params) */
export type BackCampaignRequest = NonNullable<
  paths["/api/v1/campaigns/{id}/back"]["post"]["parameters"]["path"]
>;

// ============================================================================
// Type Definitions - Response Types
// ============================================================================

/** Response from creating a campaign */
export type CreateCampaignResponse = NonNullable<
  paths["/api/v1/campaigns"]["post"]["responses"][201]["content"]["application/json"]
>;

/** Response from updating a campaign */
export type UpdateCampaignResponse =
  paths["/api/v1/campaigns/{id}"]["patch"]["responses"]["200"]["content"]["application/json"];

/** Response from advancing a campaign */
export type AdvanceCampaignResponse = NonNullable<
  paths["/api/v1/campaigns/{id}/advance"]["post"]["responses"][200]["content"]["application/json"]
>;

/** Response from going back in a campaign */
export type BackCampaignResponse =
  paths["/api/v1/campaigns/{id}/back"]["post"]["responses"]["200"]["content"]["application/json"];

// ============================================================================
// Type Definitions - Error Types
// ============================================================================

/** Error response for campaign update validation failures */
export type CampaignUpdateErrorResponse = NonNullable<
  paths["/api/v1/campaigns/{id}"]["patch"]["responses"]["422"]["content"]["application/json"]
>;

/** Error response for campaign advance/back errors */
export type CampaignAdvanceErrorResponse =
  paths["/api/v1/campaigns/{id}/advance"]["post"]["responses"]["422"]["content"]["application/json"];

// ============================================================================
// Exported Wrapper Types (for hooks)
// ============================================================================

/** Request type matching the API spec (wrapped in campaign object) */
export type CampaignUpdateRequest = {
  campaign: UpdateCampaignRequestBody;
};

/** Parameters for creating a new campaign */
export type CreateCampaignParams = NonNullable<CreateCampaignRequest["campaign"]>;

// ============================================================================
// Helper Types (simpler interfaces for service usage)
// ============================================================================

/** Simple params for creating a campaign (camelCase, service wraps for API) */
export interface SimpleCreateCampaignParams {
  name: string;
  projectId: number;
  threadId: string;
}

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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parses error messages from campaign API error responses.
 * Handles both single error strings and field-level validation errors.
 */
export function parseCampaignErrorMessage(error: unknown): string {
  const axiosError = error as {
    response?: { data?: CampaignAdvanceErrorResponse };
    message?: string;
  };
  const data = axiosError.response?.data;

  if (data?.error) {
    return data.error;
  }

  if (data?.errors) {
    // errors can be string[] or { [key: string]: string[] }
    if (Array.isArray(data.errors)) {
      return data.errors.join(", ");
    }
    const messages = Object.entries(data.errors)
      .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
      .join("; ");
    return messages || "Validation failed";
  }

  return axiosError.message || "An error occurred";
}

// ============================================================================
// Campaign Service Class
// ============================================================================

export class CampaignAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  /**
   * Creates a new campaign
   * Accepts either the simple camelCase params or the full API request format
   */
  async create(
    options: SimpleCreateCampaignParams | CreateCampaignRequest
  ): Promise<CreateCampaignResponse> {
    const client = await this.getClient();

    // Convert simple params to API format if needed
    const body: CreateCampaignRequest =
      "campaign" in options
        ? options
        : {
            campaign: {
              name: options.name,
              project_id: options.projectId,
              thread_id: options.threadId,
            },
          };

    const response = await client.POST("/api/v1/campaigns", {
      body,
    });

    if (response.error) {
      throw new Error(`Failed to create campaign: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to create campaign: No data returned");
    }

    return response.data satisfies CreateCampaignResponse;
  }

  /**
   * Updates a campaign (autosave)
   * @param id - Campaign ID
   * @param body - Update payload
   * @param signal - Optional AbortSignal for request cancellation
   */
  async update(
    id: number,
    body: UpdateCampaignRequestBody,
    signal?: AbortSignal
  ): Promise<UpdateCampaignResponse> {
    const client = await this.getClient();
    // Rails requires params wrapped in `campaign` key, but openapi-fetch types don't reflect this
    const response = await client.PATCH("/api/v1/campaigns/{id}", {
      params: { path: { id } },
      body: { campaign: body } as unknown as UpdateCampaignRequestBody,
      signal,
    });

    if (response.error) {
      throw new Error(`Failed to update campaign: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to update campaign: No data returned");
    }

    return response.data satisfies UpdateCampaignResponse;
  }

  /**
   * Advances campaign to next stage
   */
  async advance(options: AdvanceCampaignRequest): Promise<AdvanceCampaignResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/campaigns/{id}/advance", {
      params: {
        path: { id: options.id },
      },
    });

    if (response.error) {
      throw new Error(`Failed to advance campaign: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to advance campaign: No data returned");
    }

    return response.data satisfies AdvanceCampaignResponse;
  }

  /**
   * Moves campaign back to previous stage
   */
  async back(options: BackCampaignRequest): Promise<BackCampaignResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/campaigns/{id}/back", {
      params: {
        path: { id: options.id },
      },
    });

    if (response.error) {
      throw new Error(`Failed to go back in campaign: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to go back in campaign: No data returned");
    }

    return response.data satisfies BackCampaignResponse;
  }
}

// Re-export with old name for backwards compatibility during migration
export { CampaignAPIService as CampaignService };
