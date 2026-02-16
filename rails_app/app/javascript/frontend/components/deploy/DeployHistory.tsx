import { useCallback, useEffect, useRef, useState } from "react";
import { usePage } from "@inertiajs/react";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { ArrowUturnLeftIcon } from "@heroicons/react/16/solid";
import { cn } from "@lib/utils";
import DeploymentHistoryBadge from "@components/website/deployment-history/DeploymentHistoryBadge";
import { ProjectsPagination } from "@components/projects/ProjectsPagination";
import type { DeployProps } from "@hooks/useDeployChat";
import { Skeleton } from "@components/ui/skeleton";
import { useDeploys, type DeployRecord } from "@api/deploys.hooks";
import { useRootPath } from "~/stores/sessionStore";

function formatTimestamp(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusToBadgeVariant(deploy: DeployRecord): "live" | "success" | "failed" {
  if (deploy.is_live) return "live";
  if (deploy.status === "completed") return "success";
  return "failed";
}

function DeployHistoryItem({ deploy }: { deploy: DeployRecord }) {
  const rootPath = useRootPath();
  const [rolling, setRolling] = useState(false);

  const canRollback = deploy.revertible && !deploy.is_live && deploy.status === "completed";

  const handleRollback = useCallback(async () => {
    if (!confirm("Roll back to this deployment? The current live version will be replaced."))
      return;
    setRolling(true);
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
      const res = await fetch(`${rootPath}/api/v1/deploys/${deploy.id}/rollback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || "",
        },
        credentials: "include",
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.errors?.[0] || "Rollback failed");
        setRolling(false);
      }
    } catch {
      alert("Rollback failed");
      setRolling(false);
    }
  }, [deploy.id, rootPath]);

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border bg-white px-4 py-3",
        deploy.is_live ? "border-success-300" : "border-neutral-200"
      )}
    >
      <div className="flex items-center gap-3">
        {deploy.status === "completed" ? (
          <CheckCircleIcon className="size-4 text-success-700" />
        ) : (
          <ExclamationTriangleIcon className="size-4 text-secondary-700" />
        )}
        <span className="text-sm text-base-500">{formatTimestamp(deploy.created_at)}</span>
        <DeploymentHistoryBadge variant={statusToBadgeVariant(deploy)} />
      </div>
      {canRollback && (
        <button
          onClick={handleRollback}
          disabled={rolling}
          className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-base-400 transition-all hover:border-neutral-300 hover:bg-white hover:text-base-500 disabled:opacity-50"
        >
          <ArrowUturnLeftIcon className="size-3" />
          {rolling ? "Rolling back..." : "Rollback"}
        </button>
      )}
    </div>
  );
}

function DeployHistorySkeleton() {
  return (
    <div className="flex flex-col gap-4 px-10 pb-7">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function DeployHistory() {
  const { project } = usePage<DeployProps>().props;
  const [page, setPage] = useState(1);
  const pinnedLiveDeploy = useRef<DeployRecord | null>(null);

  const projectId = project?.id;
  const { data, isLoading } = useDeploys(projectId ?? 0, page);

  const deploys = data?.deploys ?? [];
  const pagination = data?.pagination;

  // Cache the live deploy from whichever page first returns it (always page 1)
  // so it stays pinned at the top during pagination.
  useEffect(() => {
    const live = deploys.find((d) => d.is_live);
    if (live) pinnedLiveDeploy.current = live;
  }, [deploys]);

  if (!projectId) return null;
  if (isLoading && !deploys.length) return <DeployHistorySkeleton />;
  if (!deploys.length && !pinnedLiveDeploy.current) return null;

  const liveDeploy = pinnedLiveDeploy.current;
  const previousDeploys = deploys.filter((d) => !d.is_live);

  return (
    <div className="flex flex-col gap-4 px-10 pb-7">
      {liveDeploy && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-base-500">Current</span>
          <div>
            <DeployHistoryItem deploy={liveDeploy} />
          </div>
        </div>
      )}
      {previousDeploys.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-base-400">Previous</span>
          <div className="flex flex-col gap-2">
            {previousDeploys.map((d) => (
              <DeployHistoryItem key={d.id} deploy={d} />
            ))}
          </div>
        </div>
      )}
      {pagination && pagination.total_pages > 1 && (
        <ProjectsPagination pagination={pagination} onPageChange={setPage} disabled={isLoading} />
      )}
    </div>
  );
}
