import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { WebsiteService, type UpdateWebsiteResponse } from "./websites";

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
  const { jwt } = usePage<{ jwt: string }>().props;
  return useMemo(() => new WebsiteService({ jwt }), [jwt]);
}

/**
 * Hook to get the current project UUID from page props
 */
export function useProjectUuid(): string | null {
  const { project } = usePage<{ project?: { uuid: string } }>().props;
  return project?.uuid ?? null;
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
