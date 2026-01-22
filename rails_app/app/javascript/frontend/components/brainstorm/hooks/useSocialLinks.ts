import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useMemo } from "react";
import {
  SocialLinksAPIService,
  type GetSocialLinksResponse,
  type BulkUpsertSocialLinksResponse,
} from "@rails_api_base";
import { useProjectId as useCoreProjectId } from "~/stores/projectStore";
import { useJwt, useRootPath } from "~/stores/sessionStore";

// Re-export for backwards compatibility
export { SocialLinksAPIService as SocialLinksService } from "@rails_api_base";

// ============================================================================
// Query Keys
// ============================================================================

export const socialLinksKeys = {
  all: ["socialLinks"] as const,
  lists: () => [...socialLinksKeys.all, "list"] as const,
  list: (projectId: number) => [...socialLinksKeys.lists(), projectId] as const,
};

// ============================================================================
// Service Hook
// ============================================================================

/**
 * Hook that provides a memoized SocialLinksService instance
 * Reads from sessionStore instead of page props - stores are hydrated in SiteLayout.
 */
export function useSocialLinksService() {
  const jwt = useJwt();
  const rootPath = useRootPath();
  return useMemo(
    () => new SocialLinksAPIService({ jwt: jwt ?? "", baseUrl: rootPath ?? "" }),
    [jwt, rootPath]
  );
}

/**
 * Hook to get the current project ID from the core entity store.
 * The store is populated from page props and Langgraph state.
 */
function useProjectId(): number | null {
  return useCoreProjectId();
}

// ============================================================================
// Query Hooks
// ============================================================================

type SocialLinksQueryOptions = Omit<
  UseQueryOptions<GetSocialLinksResponse, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Hook for fetching social links for a project with caching.
 *
 * @example
 * ```tsx
 * const { data: socialLinks, isLoading, error } = useSocialLinks();
 * ```
 */
export function useSocialLinks(options?: SocialLinksQueryOptions) {
  const service = useSocialLinksService();
  const projectId = useProjectId();

  return useQuery({
    queryKey: socialLinksKeys.list(projectId ?? 0),
    queryFn: () => service.get(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

type MutationOptions<TData, TVariables> = Omit<
  UseMutationOptions<TData, Error, TVariables>,
  "mutationFn"
>;

export type SocialPlatform =
  | "twitter"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "website"
  | "other";

interface BulkUpsertSocialLinksVariables {
  socialLinks: Array<{
    platform: SocialPlatform;
    url: string;
  }>;
}

/**
 * Hook for bulk upserting social links.
 * Automatically invalidates the social links cache on success.
 *
 * @example
 * ```tsx
 * const { mutate, mutateAsync, isPending } = useBulkUpsertSocialLinks();
 * mutate({
 *   socialLinks: [
 *     { platform: "twitter", url: "https://twitter.com/myprofile" },
 *     { platform: "instagram", url: "https://instagram.com/myprofile" },
 *   ]
 * });
 * ```
 */
export function useBulkUpsertSocialLinks(
  options?: MutationOptions<BulkUpsertSocialLinksResponse, BulkUpsertSocialLinksVariables>
) {
  const service = useSocialLinksService();
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ socialLinks }: BulkUpsertSocialLinksVariables) => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      return service.bulkUpsert(projectId, socialLinks);
    },
    ...options,
    onSuccess: (...args) => {
      const [data] = args;
      // Always update the cache with the new data
      if (projectId) {
        queryClient.setQueryData(socialLinksKeys.list(projectId), data);
      }
      // Then call user's onSuccess if provided
      options?.onSuccess?.(...args);
    },
  });
}

interface DeleteSocialLinkVariables {
  socialLinkId: number;
}

/**
 * Hook for deleting a social link.
 * Automatically removes the link from the cache on success.
 *
 * @example
 * ```tsx
 * const { mutate } = useDeleteSocialLink();
 * mutate({ socialLinkId: 123 });
 * ```
 */
export function useDeleteSocialLink(options?: MutationOptions<void, DeleteSocialLinkVariables>) {
  const service = useSocialLinksService();
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ socialLinkId }: DeleteSocialLinkVariables) => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      return service.delete(projectId, socialLinkId);
    },
    ...options,
    onSuccess: (...args) => {
      const [, variables] = args;
      // Remove the deleted link from the cache
      if (projectId) {
        queryClient.setQueryData<GetSocialLinksResponse>(
          socialLinksKeys.list(projectId),
          (oldData) => oldData?.filter((link) => link.id !== variables.socialLinkId) ?? []
        );
      }
      // Then call user's onSuccess if provided
      options?.onSuccess?.(...args);
    },
  });
}
