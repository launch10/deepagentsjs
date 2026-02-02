import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
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
import { useLatestMutation } from "~/hooks/useLatestMutation";

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
 * Updates domain context cache with new credits and assigned_url on success.
 * The optimistic assigned_url update ensures back button navigation shows the new assignment.
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

      // Update cache immediately with new credits and assigned URL from response
      // This prevents stale credit counts and ensures back button shows new assignment
      queryClient.setQueryData<GetDomainContextResponse>(queryKey, (oldData) => {
        if (!oldData) return oldData;

        const isPlatformSubdomain = variables.isPlatformSubdomain ?? variables.domain.endsWith(".launch10.site");
        const path = data.website_url?.path ?? variables.path ?? "/";
        const normalizedPath = path === "/" ? "" : path;
        const fullUrl = `${data.domain}${normalizedPath}`;

        return {
          ...oldData,
          // Update credits (prevents stale credit count exploits)
          platform_subdomain_credits:
            data.platform_subdomain_credits as GetDomainContextResponse["platform_subdomain_credits"],
          // Update assigned URL (optimistic update for back button navigation - Requirement 8)
          // Use data from the response - website_url.id is the assigned_url id
          assigned_url: {
            id: data.website_url?.id ?? 0,
            domain_id: data.id,
            domain: data.domain,
            path,
            is_platform_subdomain: isPlatformSubdomain,
            dns_verification_status: isPlatformSubdomain ? "verified" : "pending",
            full_url: fullUrl,
          },
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

// ============================================================================
// Domain Assignment Hook (with debounce + cancel pattern)
// ============================================================================

export interface DomainAssignmentVariables {
  domain: string;
  websiteId: number;
  path: string;
  isPlatformSubdomain?: boolean;
}

/**
 * Hook for assigning a domain + path to a website with debounce and cancellation.
 * Uses useLatestMutation to:
 * - Debounce rapid changes (e.g., while typing path)
 * - Cancel stale in-flight requests when a new one is made
 * - Provide immediate save via mutateNowAsync (for explicit save button)
 *
 * @param websiteId - The website to assign the domain to
 * @param debounceMs - Debounce delay in ms (default: 750ms)
 */
export function useDomainAssignment(websiteId: number | undefined, debounceMs: number = 750) {
  const service = useDomainsService();
  const queryClient = useQueryClient();

  const updateCache = useCallback(
    (data: CreateDomainResponse, variables: DomainAssignmentVariables) => {
      if (!websiteId) return;
      const queryKey = domainContextKeys.context(websiteId);

      queryClient.setQueryData<GetDomainContextResponse>(queryKey, (oldData) => {
        if (!oldData) return oldData;

        const isPlatformSubdomain = variables.isPlatformSubdomain ?? variables.domain.endsWith(".launch10.site");
        const path = data.website_url?.path ?? variables.path ?? "/";
        const normalizedPath = path === "/" ? "" : path;
        const fullUrl = `${data.domain}${normalizedPath}`;

        return {
          ...oldData,
          platform_subdomain_credits:
            data.platform_subdomain_credits as GetDomainContextResponse["platform_subdomain_credits"],
          assigned_url: {
            id: data.website_url?.id ?? 0,
            domain_id: data.id,
            domain: data.domain,
            path,
            is_platform_subdomain: isPlatformSubdomain,
            dns_verification_status: isPlatformSubdomain ? "verified" : "pending",
            full_url: fullUrl,
          },
        };
      });

      queryClient.invalidateQueries({ queryKey });
    },
    [websiteId, queryClient]
  );

  return useLatestMutation<CreateDomainResponse, DomainAssignmentVariables>({
    mutationKey: ["domain-assignment", websiteId],
    mutationFn: async (variables: DomainAssignmentVariables, signal: AbortSignal) => {
      return service.create(
        {
          domain: variables.domain,
          website_id: variables.websiteId,
          path: variables.path ?? "/",
          is_platform_subdomain: variables.isPlatformSubdomain ?? variables.domain.endsWith(".launch10.site"),
        } as Parameters<typeof service.create>[0],
        { signal }
      );
    },
    debounceMs,
    onSuccess: updateCache,
  });
}
