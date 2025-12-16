import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { apiClient } from "./client";

type HttpMethod = "post" | "patch" | "delete";

type MutationConfig<TData, TVariables> = {
  /** HTTP method for the request */
  method: HttpMethod;
  /** Function that returns the URL (allows dynamic URLs based on closure variables) */
  getUrl: () => string;
} & Omit<UseMutationOptions<TData, AxiosError, TVariables>, "mutationFn">;

/**
 * Factory function for creating API mutations with consistent configuration.
 * Reduces boilerplate by handling axios setup and error typing.
 *
 * @example
 * ```tsx
 * export function useCreateCampaign() {
 *   return createApiMutation<CreateCampaignResponse, CreateCampaignParams>({
 *     method: "post",
 *     getUrl: () => campaignEndpoints.list,
 *   });
 * }
 * ```
 */
export function createApiMutation<TData, TVariables = void>({
  method,
  getUrl,
  ...options
}: MutationConfig<TData, TVariables>) {
  return useMutation<TData, AxiosError, TVariables>({
    mutationFn: async (variables: TVariables) => {
      const url = getUrl();
      const response = await apiClient[method]<TData>(
        url,
        method === "delete" ? undefined : variables
      );
      return response.data;
    },
    ...options,
  });
}

type MutationWithIdConfig<TData, TVariables> = {
  /** HTTP method for the request */
  method: HttpMethod;
  /** Function that returns the URL given an ID */
  getUrl: (id: number) => string;
  /** The resource ID (when undefined, mutation will throw) */
  id: number | undefined;
  /** Error message when ID is missing */
  idRequiredMessage?: string;
} & Omit<UseMutationOptions<TData, AxiosError, TVariables>, "mutationFn">;

/**
 * Factory function for creating API mutations that require a resource ID.
 * Handles the common pattern of validating ID existence before making requests.
 *
 * @example
 * ```tsx
 * export function useAutosaveCampaign(campaignId: number | undefined) {
 *   return createApiMutationWithId<CampaignUpdateResponse, CampaignUpdateRequest>({
 *     method: "patch",
 *     getUrl: campaignEndpoints.detail,
 *     id: campaignId,
 *     idRequiredMessage: "Campaign ID is required for autosave",
 *   });
 * }
 * ```
 */
export function createApiMutationWithId<TData, TVariables = void>({
  method,
  getUrl,
  id,
  idRequiredMessage = "Resource ID is required",
  ...options
}: MutationWithIdConfig<TData, TVariables>) {
  return useMutation<TData, AxiosError, TVariables>({
    mutationFn: async (variables: TVariables) => {
      if (id === undefined) {
        throw new Error(idRequiredMessage);
      }
      const url = getUrl(id);
      const response = await apiClient[method]<TData>(
        url,
        method === "delete" ? undefined : variables
      );
      return response.data;
    },
    ...options,
  });
}
