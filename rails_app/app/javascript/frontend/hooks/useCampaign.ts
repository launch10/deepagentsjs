import type { paths } from "@rails_api";
import { createApiMutation, createApiMutationWithId } from "./api/createMutation";
import { campaignEndpoints } from "./api/endpoints";

// ============================================================================
// Type Definitions
// ============================================================================

type CreateCampaignRequest = NonNullable<
  paths["/api/v1/campaigns"]["post"]["requestBody"]
>["content"]["application/json"];

type CreateCampaignResponse = NonNullable<
  paths["/api/v1/campaigns"]["post"]["responses"][201]["content"]
>["application/json"];

type CampaignUpdateRequestBody = NonNullable<
  paths["/api/v1/campaigns/{id}"]["patch"]["requestBody"]
>["content"]["application/json"];

type CampaignUpdateResponse =
  paths["/api/v1/campaigns/{id}"]["patch"]["responses"]["200"]["content"]["application/json"];

type CampaignAdvanceResponse =
  paths["/api/v1/campaigns/{id}/advance"]["post"]["responses"]["200"]["content"]["application/json"];

type CampaignBackResponse =
  paths["/api/v1/campaigns/{id}/back"]["post"]["responses"]["200"]["content"]["application/json"];

// ============================================================================
// Exported Types
// ============================================================================

/** Request type matching the API spec (wrapped in campaign object) */
export type CampaignUpdateRequest = {
  campaign: CampaignUpdateRequestBody;
};

/** Parameters for creating a new campaign */
export type CreateCampaignParams = NonNullable<CreateCampaignRequest["campaign"]>;

/** Error response structure for campaign autosave validation errors */
export type CampaignAutosaveErrorResponse = NonNullable<
  paths["/api/v1/campaigns/{id}"]["patch"]["responses"]["422"]["content"]["application/json"]
>;

/** Error response structure for campaign advance/back errors */
export type CampaignAdvanceErrorResponse =
  paths["/api/v1/campaigns/{id}/advance"]["post"]["responses"]["422"]["content"]["application/json"];

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
// Hooks
// ============================================================================

/**
 * Hook for creating a new campaign.
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useCreateCampaign();
 * mutate({ name: "My Campaign" });
 * ```
 */
export function useCreateCampaign() {
  return createApiMutation<CreateCampaignResponse, { campaign: CreateCampaignParams }>({
    method: "post",
    getUrl: () => campaignEndpoints.list,
  });
}

/**
 * Hook for autosaving campaign changes.
 * Requires a campaign ID to be provided.
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useAutosaveCampaign(campaignId);
 * mutate({ campaign: { headlines: [...] } });
 * ```
 */
export function useAutosaveCampaign(campaignId: number | undefined) {
  return createApiMutationWithId<CampaignUpdateResponse, CampaignUpdateRequest>({
    method: "patch",
    getUrl: campaignEndpoints.detail,
    id: campaignId,
    idRequiredMessage: "Campaign ID is required for autosave",
  });
}

/**
 * Hook for advancing a campaign to the next stage.
 *
 * @example
 * ```tsx
 * const { mutate } = useAdvanceCampaign(campaignId);
 * mutate();
 * ```
 */
export function useAdvanceCampaign(campaignId: number | undefined) {
  return createApiMutationWithId<CampaignAdvanceResponse, void>({
    method: "post",
    getUrl: campaignEndpoints.advance,
    id: campaignId,
    idRequiredMessage: "Campaign ID is required for advance",
  });
}

/**
 * Hook for moving a campaign back to the previous stage.
 *
 * @example
 * ```tsx
 * const { mutate } = useBackCampaign(campaignId);
 * mutate();
 * ```
 */
export function useBackCampaign(campaignId: number | undefined) {
  return createApiMutationWithId<CampaignBackResponse, void>({
    method: "post",
    getUrl: campaignEndpoints.back,
    id: campaignId,
    idRequiredMessage: "Campaign ID is required for back",
  });
}
