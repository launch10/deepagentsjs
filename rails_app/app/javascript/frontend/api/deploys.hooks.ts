import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useRootPath } from "~/stores/sessionStore";
import type { PaginationMeta } from "@rails_api_base";
import type { DeployRecord } from "./deploys.types";

export type { DeployRecord } from "./deploys.types";

export interface DeploysResponse {
  deploys: DeployRecord[];
  pagination: PaginationMeta;
}

export const deploysKeys = {
  all: ["deploys"] as const,
  lists: () => [...deploysKeys.all, "list"] as const,
  list: (params: { project_id: number; page: number }) =>
    [...deploysKeys.lists(), params] as const,
  hasCompleted: (params: { project_id: number; instructions: Record<string, boolean> }) =>
    [...deploysKeys.all, "hasCompleted", params] as const,
};

/**
 * Fetch paginated deploy history for a project.
 */
export function useDeploys(projectId: number, page: number) {
  const rootPath = useRootPath();

  return useQuery<DeploysResponse>({
    queryKey: deploysKeys.list({ project_id: projectId, page }),
    queryFn: async () => {
      const res = await fetch(
        `${rootPath}/api/v1/deploys?project_id=${projectId}&page=${page}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch deploys");
      return res.json();
    },
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
  const rootPath = useRootPath();

  return useQuery<boolean>({
    queryKey: deploysKeys.hasCompleted({ project_id: projectId, instructions }),
    queryFn: async () => {
      const params = new URLSearchParams({
        project_id: String(projectId),
        status: "completed",
      });
      // Add instruction filters as nested params
      for (const [key, val] of Object.entries(instructions)) {
        params.append(`instructions[${key}]`, String(val));
      }
      const res = await fetch(`${rootPath}/api/v1/deploys?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to check deploy history");
      const data: DeploysResponse = await res.json();
      return data.deploys.length > 0;
    },
    enabled: projectId > 0 && !!rootPath,
    staleTime: 60_000,
  });
}
