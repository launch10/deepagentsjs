import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useMemo } from "react";
import {
  DomainContextAPIService,
  DomainsAPIService,
  WebsiteUrlsAPIService,
  type GetDomainContextResponse,
  type CreateDomainResponse,
  type SearchWebsiteUrlsResponse,
} from "@rails_api_base";
import { useWebsiteId } from "~/stores/projectStore";
import { useJwt, useRootPath } from "~/stores/sessionStore";

// ============================================================================
// Query Keys
// ============================================================================

export const domainContextKeys = {
  all: ["domainContext"] as const,
  context: (websiteId: number) => [...domainContextKeys.all, "context", websiteId] as const,
};

export const websiteUrlsKeys = {
  all: ["websiteUrls"] as const,
  search: (domainId: number, paths: string[]) =>
    [...websiteUrlsKeys.all, "search", domainId, paths.join(",")] as const,
};

// ============================================================================
// Service Hooks
// ============================================================================

export function useDomainContextService() {
  const jwt = useJwt();
  const rootPath = useRootPath();
  return useMemo(
    () => new DomainContextAPIService({ jwt: jwt ?? "", baseUrl: rootPath ?? "" }),
    [jwt, rootPath]
  );
}

export function useDomainsService() {
  const jwt = useJwt();
  const rootPath = useRootPath();
  return useMemo(
    () => new DomainsAPIService({ jwt: jwt ?? "", baseUrl: rootPath ?? "" }),
    [jwt, rootPath]
  );
}

export function useWebsiteUrlsService() {
  const jwt = useJwt();
  const rootPath = useRootPath();
  return useMemo(
    () => new WebsiteUrlsAPIService({ jwt: jwt ?? "", baseUrl: rootPath ?? "" }),
    [jwt, rootPath]
  );
}

// ============================================================================
// Query Hooks
// ============================================================================

type DomainContextQueryOptions = Omit<
  UseQueryOptions<GetDomainContextResponse, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Hook for fetching domain context from Rails API.
 * Returns existing domains, subdomain credits, and brainstorm context.
 *
 * For AI-generated domain recommendations, use useWebsiteChat().state.domainRecommendations
 * which comes from the website graph.
 */
export function useDomainContext(websiteId?: number, options?: DomainContextQueryOptions) {
  const service = useDomainContextService();
  const currentWebsiteId = useWebsiteId();
  const effectiveWebsiteId = websiteId ?? currentWebsiteId;

  return useQuery({
    queryKey: domainContextKeys.context(effectiveWebsiteId ?? 0),
    queryFn: () => service.get(effectiveWebsiteId!),
    enabled: !!effectiveWebsiteId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export interface CreateDomainVariables {
  domain: string;
  websiteId: number;
  path?: string;
  isPlatformSubdomain?: boolean;
}

export interface UpdateDomainVariables {
  domainId: number;
  websiteId: number;
}

type CreateDomainMutationOptions = Omit<
  UseMutationOptions<CreateDomainResponse, Error, CreateDomainVariables>,
  "mutationFn"
>;

/**
 * Hook for creating a new domain and assigning it to a website.
 * Updates domain context cache with new credits on success to prevent stale data exploits.
 */
export function useCreateDomain(options?: CreateDomainMutationOptions) {
  const service = useDomainsService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ domain, websiteId, path, isPlatformSubdomain }: CreateDomainVariables) => {
      return service.create({
        domain,
        website_id: websiteId,
        path: path ?? "/",
        is_platform_subdomain: isPlatformSubdomain ?? domain.endsWith(".launch10.site"),
      } as Parameters<typeof service.create>[0]);
    },
    onSuccess: (data, variables) => {
      const queryKey = domainContextKeys.context(variables.websiteId);

      // Update cache immediately with new credits from response
      // This prevents stale credit counts that could allow UI exploits
      queryClient.setQueryData<GetDomainContextResponse>(queryKey, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          // Cast to ensure type compatibility - the response structure matches
          platform_subdomain_credits:
            data.platform_subdomain_credits as GetDomainContextResponse["platform_subdomain_credits"],
        };
      });

      // Also invalidate to ensure full refresh on next access
      queryClient.invalidateQueries({ queryKey });
    },
    ...options,
  });
}

type UpdateDomainMutationOptions = Omit<
  UseMutationOptions<unknown, Error, UpdateDomainVariables>,
  "mutationFn"
>;

/**
 * Hook for reassigning an existing domain to a different website.
 * Invalidates domain context cache on success.
 */
export function useUpdateDomain(options?: UpdateDomainMutationOptions) {
  const service = useDomainsService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ domainId, websiteId }: UpdateDomainVariables) => {
      return service.update(domainId, {
        website_id: websiteId,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: domainContextKeys.context(variables.websiteId),
      });
    },
    ...options,
  });
}

// ============================================================================
// Website URL Hooks
// ============================================================================

type SearchWebsiteUrlsQueryOptions = Omit<
  UseQueryOptions<SearchWebsiteUrlsResponse, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Hook for checking path availability on a domain.
 * Returns availability status for each candidate path.
 */
export function useSearchWebsiteUrls(
  domainId: number | undefined,
  paths: string[],
  options?: SearchWebsiteUrlsQueryOptions
) {
  const service = useWebsiteUrlsService();

  return useQuery({
    queryKey: websiteUrlsKeys.search(domainId ?? 0, paths),
    queryFn: () => service.search(domainId!, paths),
    enabled: !!domainId && paths.length > 0,
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
}
