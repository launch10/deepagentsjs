import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useRootPath } from "~/stores/sessionStore";
import type { PaginationMeta } from "@rails_api_base";
import type { WebsiteDeployRecord } from "@hooks/useDeployChat";

export interface WebsiteDeploysResponse {
  website_deploys: WebsiteDeployRecord[];
  pagination: PaginationMeta;
}

export const websiteDeploysKeys = {
  all: ["websiteDeploys"] as const,
  lists: () => [...websiteDeploysKeys.all, "list"] as const,
  list: (params: { website_id: number; page: number }) =>
    [...websiteDeploysKeys.lists(), params] as const,
};

export function useWebsiteDeploys(websiteId: number, page: number) {
  const rootPath = useRootPath();

  return useQuery<WebsiteDeploysResponse>({
    queryKey: websiteDeploysKeys.list({ website_id: websiteId, page }),
    queryFn: async () => {
      const res = await fetch(
        `${rootPath}/api/v1/website_deploys?website_id=${websiteId}&page=${page}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch deploys");
      return res.json();
    },
    enabled: websiteId > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
