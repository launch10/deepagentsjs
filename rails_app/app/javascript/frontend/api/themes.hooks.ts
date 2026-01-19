import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import {
  ThemeAPIService,
  type GetThemesResponse,
  type CreateThemeRequest,
  type CreateThemeResponse,
} from "@rails_api_base";

// Re-export for backwards compatibility
export { ThemeAPIService as ThemeService } from "@rails_api_base";

// ============================================================================
// Query Keys
// ============================================================================

export const themeKeys = {
  all: ["themes"] as const,
  lists: () => [...themeKeys.all, "list"] as const,
};

// ============================================================================
// Service Hook
// ============================================================================

/**
 * Hook that provides a memoized ThemeService instance
 * Uses JWT from page props for authentication
 */
export function useThemeService() {
  const { jwt, root_path } = usePage<{ jwt: string; root_path: string }>().props;
  return useMemo(() => new ThemeAPIService({ jwt, baseUrl: root_path }), [jwt, root_path]);
}

// ============================================================================
// Query Hooks
// ============================================================================

type ThemesQueryOptions = Omit<
  UseQueryOptions<GetThemesResponse, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Hook for fetching themes with caching.
 * Themes are cached and automatically refetched when stale.
 *
 * @example
 * ```tsx
 * const { data: themes, isLoading, error } = useThemes();
 * ```
 */
export function useThemes(options?: ThemesQueryOptions) {
  const service = useThemeService();

  return useQuery({
    queryKey: themeKeys.lists(),
    queryFn: () => service.list(),
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

interface CreateThemeVariables {
  name: string;
  colors: string[];
}

/**
 * Hook for creating a new custom theme.
 * Automatically invalidates the themes cache on success.
 *
 * @example
 * ```tsx
 * const { mutate, mutateAsync, isPending } = useCreateTheme();
 * mutate({ name: "My Theme", colors: ["#FF0000", "#00FF00", "#0000FF"] });
 * ```
 */
export function useCreateTheme(
  options?: MutationOptions<CreateThemeResponse, CreateThemeVariables>
) {
  const service = useThemeService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, colors }: CreateThemeVariables) =>
      service.create({ theme: { name, colors } }),
    onSuccess: (newTheme) => {
      // Optimistically update the cache by prepending the new theme
      queryClient.setQueryData<GetThemesResponse>(themeKeys.lists(), (old) => {
        if (!old) return [newTheme];
        return [newTheme, ...old];
      });
    },
    ...options,
  });
}
