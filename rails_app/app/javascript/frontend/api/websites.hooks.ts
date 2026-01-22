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
  WebsiteAPIService,
  type GetWebsiteResponse,
  type UpdateWebsiteResponse,
} from "@rails_api_base";
import { useWebsiteId as useCoreWebsiteId } from "~/stores/projectStore";
import { useJwt, useRootPath } from "~/stores/sessionStore";

// Re-export for backwards compatibility
export { WebsiteAPIService as WebsiteService } from "@rails_api_base";

// ============================================================================
// Query Keys
// ============================================================================

export const websiteKeys = {
  all: ["websites"] as const,
  details: () => [...websiteKeys.all, "detail"] as const,
  detail: (websiteId: number) => [...websiteKeys.details(), websiteId] as const,
};

// ============================================================================
// Service Hook
// ============================================================================

/**
 * Hook that provides a memoized WebsiteService instance
 * Reads from sessionStore instead of page props - stores are hydrated in SiteLayout.
 */
export function useWebsiteService() {
  const jwt = useJwt();
  const rootPath = useRootPath();
  return useMemo(
    () => new WebsiteAPIService({ jwt: jwt ?? "", baseUrl: rootPath ?? "" }),
    [jwt, rootPath]
  );
}

/**
 * Hook to get the current website ID from the core entity store.
 * The store is populated from page props and Langgraph state.
 */
function useWebsiteId(): number | null {
  return useCoreWebsiteId();
}

// ============================================================================
// Query Hooks
// ============================================================================

type WebsiteQueryOptions = Omit<UseQueryOptions<GetWebsiteResponse, Error>, "queryKey" | "queryFn">;

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
  const websiteId = useWebsiteId();
  // Get initial data from Inertia props if available
  const { website: initialWebsite } = usePage<{ website?: GetWebsiteResponse }>().props;

  return useQuery({
    queryKey: websiteKeys.detail(websiteId ?? 0),
    queryFn: () => service.get(websiteId!),
    enabled: !!websiteId,
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
  const websiteId = useWebsiteId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ themeId }: UpdateWebsiteThemeVariables) => {
      if (!websiteId) {
        throw new Error("Website ID is required");
      }
      return service.update(websiteId, { theme_id: themeId });
    },
    onSuccess: (data) => {
      // Update the website cache if needed
      if (websiteId) {
        queryClient.setQueryData(websiteKeys.detail(websiteId), data);
      }
    },
    ...options,
  });
}
