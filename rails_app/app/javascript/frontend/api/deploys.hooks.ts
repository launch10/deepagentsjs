import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  DeployAPIService,
  type DeploysListResponse,
  type DeployRecord,
} from "@rails_api_base";
import { useJwt, useRootPath } from "~/stores/sessionStore";

export type { DeployRecord, DeploysListResponse } from "@rails_api_base";

// ============================================================================
// Query Keys
// ============================================================================

export const deploysKeys = {
  all: ["deploys"] as const,
  lists: () => [...deploysKeys.all, "list"] as const,
  list: (params: { project_id: number; page: number }) =>
    [...deploysKeys.lists(), params] as const,
  hasCompleted: (params: { project_id: number; instructions: Record<string, boolean> }) =>
    [...deploysKeys.all, "hasCompleted", params] as const,
};

// ============================================================================
// Service Hook
// ============================================================================

export function useDeployService() {
  const jwt = useJwt();
  const rootPath = useRootPath();
  return useMemo(
    () => new DeployAPIService({ jwt: jwt ?? "", baseUrl: rootPath ?? "" }),
    [jwt, rootPath]
  );
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch paginated deploy history for a project.
 */
export function useDeploys(projectId: number, page: number) {
  const service = useDeployService();
  const rootPath = useRootPath();

  return useQuery<DeploysListResponse>({
    queryKey: deploysKeys.list({ project_id: projectId, page }),
    queryFn: () => service.list({ project_id: projectId, page }),
    enabled: projectId > 0 && !!rootPath,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Check if a project has EVER had a completed deploy with the given instructions.
 * Used by useDeployInit to decide whether to auto-trigger.
 */
export function useHasCompletedDeploy(
  projectId: number,
  instructions: Record<string, boolean>
) {
  const service = useDeployService();
  const rootPath = useRootPath();

  return useQuery<boolean>({
    queryKey: deploysKeys.hasCompleted({ project_id: projectId, instructions }),
    queryFn: async () => {
      const data = await service.list({
        project_id: projectId,
        status: "completed",
      });
      return data.deploys.length > 0;
    },
    enabled: projectId > 0 && !!rootPath,
    staleTime: 60_000,
  });
}
