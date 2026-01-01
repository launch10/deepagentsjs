import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { WebsiteAPIService, type GetWebsiteResponse, type UpdateWebsiteResponse } from "@rails_api_base";
import { useBrainstormChatThreadId } from "~/hooks/useBrainstormChat";

// Re-export for backwards compatibility
export { WebsiteAPIService as WebsiteService } from "@rails_api_base";

// ============================================================================
// Query Keys
// ============================================================================

export const websiteKeys = {
  all: ["websites"] as const,
  details: () => [...websiteKeys.all, "detail"] as const,
  detail: (projectUuid: string) => [...websiteKeys.details(), projectUuid] as const,
};

// ============================================================================
// Service Hook
// ============================================================================

/**
 * Hook that provides a memoized WebsiteService instance
 * Uses JWT from page props for authentication
 */
export function useWebsiteService() {
  const { jwt, root_path } = usePage<{ jwt: string; root_path: string }>().props;
  return useMemo(() => new WebsiteAPIService({ jwt, baseUrl: root_path }), [jwt, root_path]);
}

/**
 * Hook to get the current project UUID from chat state (primary) or page props (fallback).
 * Chat state is primary because after history.pushState, Inertia props don't update.
 * The threadId in chat state IS the project UUID.
 */
function useProjectUuid(): string | null {
  const chatThreadId = useBrainstormChatThreadId();
  const { project } = usePage<{ project?: { uuid: string } }>().props;
  return chatThreadId ?? project?.uuid ?? null;
}

// ============================================================================
// Query Hooks
// ============================================================================

type WebsiteQueryOptions = Omit<
  UseQueryOptions<GetWebsiteResponse, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Hook for fetching website data with caching.
 * First checks Inertia page props for initial data, then falls back to API.
 *
 * @example
 * ```tsx
 * const { data: website, isLoading, error } = useWebsite();
 * console.log(website?.theme_id);
 * ```
 */
export function useWebsite(options?: WebsiteQueryOptions) {
  const service = useWebsiteService();
  const projectUuid = useProjectUuid();
  // Get initial data from Inertia props if available
  const { website: initialWebsite } = usePage<{ website?: GetWebsiteResponse }>().props;

  return useQuery({
    queryKey: websiteKeys.detail(projectUuid ?? ""),
    queryFn: () => service.get(projectUuid!),
    enabled: !!projectUuid,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Use Inertia props as initial data if available
    initialData: initialWebsite ?? undefined,
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

interface UpdateWebsiteThemeVariables {
  themeId: number | null;
}

/**
 * Hook for updating the website's theme.
 * Automatically invalidates related caches on success.
 *
 * @example
 * ```tsx
 * const { mutate, mutateAsync, isPending } = useUpdateWebsiteTheme();
 * mutate({ themeId: 5 });
 * // or to clear theme:
 * mutate({ themeId: null });
 * ```
 */
export function useUpdateWebsiteTheme(
  options?: MutationOptions<UpdateWebsiteResponse, UpdateWebsiteThemeVariables>
) {
  const service = useWebsiteService();
  const projectUuid = useProjectUuid();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ themeId }: UpdateWebsiteThemeVariables) => {
      if (!projectUuid) {
        throw new Error("Project UUID is required");
      }
      return service.update(projectUuid, { theme_id: themeId });
    },
    onSuccess: (data) => {
      // Update the website cache if needed
      if (projectUuid) {
        queryClient.setQueryData(websiteKeys.detail(projectUuid), data);
      }
    },
    ...options,
  });
}
