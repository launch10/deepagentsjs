import {
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  ProjectsAPIService,
  type GetProjectsRequest,
  type ProjectsListResponse,
} from "@rails_api_base";
import { useJwt, useRootPath } from "~/stores/sessionStore";

// ============================================================================
// Query Keys
// ============================================================================

export const projectsKeys = {
  all: ["projects"] as const,
  lists: () => [...projectsKeys.all, "list"] as const,
  list: (params: GetProjectsRequest) => [...projectsKeys.lists(), params] as const,
};

// ============================================================================
// Service Hook
// ============================================================================

export function useProjectsService() {
  const jwt = useJwt();
  const rootPath = useRootPath();
  return useMemo(
    () => new ProjectsAPIService({ jwt: jwt ?? "", baseUrl: rootPath ?? "" }),
    [jwt, rootPath]
  );
}

// ============================================================================
// Query Hooks
// ============================================================================

type ProjectsQueryOptions = Omit<
  UseQueryOptions<ProjectsListResponse, Error>,
  "queryKey" | "queryFn"
>;

export interface UseProjectsParams extends GetProjectsRequest {
  /** Whether to prefetch adjacent pages for instant pagination */
  prefetchAdjacent?: boolean;
}

/**
 * Hook for fetching paginated projects.
 *
 * @param params - Query parameters (page, status) and options
 * @param options - React Query options
 * @returns Query result with projects and pagination metadata
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useProjects({ page: 1 });
 * const { projects, pagination } = data ?? {};
 * ```
 */
export function useProjects(params?: UseProjectsParams, options?: ProjectsQueryOptions) {
  const { prefetchAdjacent = false, ...queryParams } = params ?? {};
  const service = useProjectsService();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: projectsKeys.list(queryParams),
    queryFn: () => service.get(queryParams),
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });

  // Prefetch adjacent pages for instant pagination
  useEffect(() => {
    if (!prefetchAdjacent || !query.data?.pagination) return;

    const { prev_page, next_page } = query.data.pagination;

    // Prefetch previous page
    if (prev_page) {
      const prevParams = { ...queryParams, page: prev_page };
      queryClient.prefetchQuery({
        queryKey: projectsKeys.list(prevParams),
        queryFn: () => service.get(prevParams),
        staleTime: 30 * 1000,
      });
    }

    // Prefetch next page
    if (next_page) {
      const nextParams = { ...queryParams, page: next_page };
      queryClient.prefetchQuery({
        queryKey: projectsKeys.list(nextParams),
        queryFn: () => service.get(nextParams),
        staleTime: 30 * 1000,
      });
    }
  }, [query.data?.pagination, prefetchAdjacent, queryParams, queryClient, service]);

  return query;
}
