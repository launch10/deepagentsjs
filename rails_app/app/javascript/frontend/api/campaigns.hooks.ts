import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import type { CampaignProps } from "@components/ads/sidebar/workflow-buddy/ad-campaign.types";
import {
  CampaignService,
  type CreateCampaignRequest,
  type CreateCampaignResponse,
  type UpdateCampaignRequestBody,
  type UpdateCampaignResponse,
  type AdvanceCampaignResponse,
  type BackCampaignResponse,
  type CampaignUpdateRequest,
} from "./campaigns";

// Re-export types for convenience
export type { CampaignUpdateRequest } from "./campaigns";

// ============================================================================
// Service Hook
// ============================================================================

/**
 * Hook that provides a memoized CampaignService instance
 * Uses JWT from page props for authentication
 */
export function useCampaignService() {
  const { jwt } = usePage<CampaignProps>().props;
  return useMemo(() => new CampaignService({ jwt }), [jwt]);
}

// ============================================================================
// Mutation Hooks
// ============================================================================

type MutationOptions<TData, TVariables> = Omit<
  UseMutationOptions<TData, Error, TVariables>,
  "mutationFn"
>;

/**
 * Hook for creating a new campaign.
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useCreateCampaign();
 * mutate({ campaign: { name: "My Campaign", project_id: 1, thread_id: "..." } });
 * ```
 */
export function useCreateCampaign(
  options?: MutationOptions<CreateCampaignResponse, CreateCampaignRequest>
) {
  const service = useCampaignService();

  return useMutation({
    mutationFn: (variables: CreateCampaignRequest) => service.create(variables),
    ...options,
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
export function useAutosaveCampaign(
  campaignId: number | undefined,
  options?: MutationOptions<UpdateCampaignResponse, CampaignUpdateRequest>
) {
  const service = useCampaignService();

  return useMutation({
    mutationFn: async (variables: CampaignUpdateRequest) => {
      if (campaignId === undefined) {
        throw new Error("Campaign ID is required for autosave");
      }
      return service.update(campaignId, variables.campaign);
    },
    ...options,
  });
}

/**
 * Hook for updating a campaign directly with the request body.
 * Lower-level than useAutosaveCampaign - doesn't wrap in { campaign: ... }
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useUpdateCampaign(campaignId);
 * mutate({ headlines: [...] });
 * ```
 */
export function useUpdateCampaign(
  campaignId: number | undefined,
  options?: MutationOptions<UpdateCampaignResponse, UpdateCampaignRequestBody>
) {
  const service = useCampaignService();

  return useMutation({
    mutationFn: async (variables: UpdateCampaignRequestBody) => {
      if (campaignId === undefined) {
        throw new Error("Campaign ID is required for update");
      }
      return service.update(campaignId, variables);
    },
    ...options,
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
export function useAdvanceCampaign(
  campaignId: number | undefined,
  options?: MutationOptions<AdvanceCampaignResponse, void>
) {
  const service = useCampaignService();

  return useMutation({
    mutationFn: async () => {
      if (campaignId === undefined) {
        throw new Error("Campaign ID is required for advance");
      }
      return service.advance({ id: campaignId });
    },
    ...options,
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
export function useBackCampaign(
  campaignId: number | undefined,
  options?: MutationOptions<BackCampaignResponse, void>
) {
  const service = useCampaignService();

  return useMutation({
    mutationFn: async () => {
      if (campaignId === undefined) {
        throw new Error("Campaign ID is required for back");
      }
      return service.back({ id: campaignId });
    },
    ...options,
  });
}
