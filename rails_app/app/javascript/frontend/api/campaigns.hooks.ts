import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import type { CampaignProps } from "@components/ads/workflow-panel/workflow-buddy/ad-campaign.types";
export { useAutosaveCampaign } from "@components/ads/hooks/useAutosaveCampaign";
import {
  CampaignAPIService,
  type CreateCampaignRequest,
  type CreateCampaignResponse,
  type AdvanceCampaignResponse,
  type BackCampaignResponse,
  type CampaignUpdateRequest,
} from "@rails_api_base";

// Re-export types and service for convenience
export type { CampaignUpdateRequest };
export { CampaignAPIService as CampaignService } from "@rails_api_base";

// ============================================================================
// Service Hook
// ============================================================================

/**
 * Hook that provides a memoized CampaignService instance
 * Uses JWT from page props for authentication
 */
export function useCampaignService() {
  const { jwt, root_path } = usePage<CampaignProps>().props;
  return useMemo(() => new CampaignAPIService({ jwt, baseUrl: root_path }), [jwt, root_path]);
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
