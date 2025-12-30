import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import {
  SocialLinksService,
  type GetSocialLinksResponse,
  type BulkUpsertSocialLinksResponse,
} from "./socialLinks";

// ============================================================================
// Query Keys
// ============================================================================

export const socialLinksKeys = {
  all: ["socialLinks"] as const,
  lists: () => [...socialLinksKeys.all, "list"] as const,
  list: (projectUuid: string) => [...socialLinksKeys.lists(), projectUuid] as const,
};

// ============================================================================
// Service Hook
// ============================================================================

/**
 * Hook that provides a memoized SocialLinksService instance
 * Uses JWT from page props for authentication
 */
export function useSocialLinksService() {
  const { jwt } = usePage<{ jwt: string }>().props;
  return useMemo(() => new SocialLinksService({ jwt }), [jwt]);
}

/**
 * Hook to get the current project UUID from page props
 */
function useProjectUuid(): string | null {
  const { project } = usePage<{ project?: { uuid: string } }>().props;
  return project?.uuid ?? null;
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
  const projectUuid = useProjectUuid();

  return useQuery({
    queryKey: socialLinksKeys.list(projectUuid ?? ""),
    queryFn: () => service.get(projectUuid!),
    enabled: !!projectUuid,
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

export type SocialPlatform = "twitter" | "instagram" | "facebook" | "linkedin" | "youtube" | "tiktok" | "website" | "other";

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
  const projectUuid = useProjectUuid();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ socialLinks }: BulkUpsertSocialLinksVariables) => {
      if (!projectUuid) {
        throw new Error("Project UUID is required");
      }
      return service.bulkUpsert(projectUuid, socialLinks);
    },
    ...options,
    onSuccess: (...args) => {
      const [data] = args;
      // Always update the cache with the new data
      if (projectUuid) {
        queryClient.setQueryData(socialLinksKeys.list(projectUuid), data);
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
export function useDeleteSocialLink(
  options?: MutationOptions<void, DeleteSocialLinkVariables>
) {
  const service = useSocialLinksService();
  const projectUuid = useProjectUuid();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ socialLinkId }: DeleteSocialLinkVariables) => {
      if (!projectUuid) {
        throw new Error("Project UUID is required");
      }
      return service.delete(projectUuid, socialLinkId);
    },
    ...options,
    onSuccess: (...args) => {
      const [, variables] = args;
      // Remove the deleted link from the cache
      if (projectUuid) {
        queryClient.setQueryData<GetSocialLinksResponse>(
          socialLinksKeys.list(projectUuid),
          (oldData) => oldData?.filter((link) => link.id !== variables.socialLinkId) ?? []
        );
      }
      // Then call user's onSuccess if provided
      options?.onSuccess?.(...args);
    },
  });
}
