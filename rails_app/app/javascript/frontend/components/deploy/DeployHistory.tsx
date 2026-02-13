import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { ArrowUturnLeftIcon } from "@heroicons/react/16/solid";
import { cn } from "@lib/utils";
import { Button } from "@components/ui/button";
import DeploymentHistoryBadge from "@components/website/deployment-history/DeploymentHistoryBadge";
import type { DeployProps, WebsiteDeployRecord } from "@hooks/useDeployChat";
import { useRootPath } from "~/stores/sessionStore";

function formatTimestamp(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusToBadgeVariant(deploy: WebsiteDeployRecord): "live" | "success" | "failed" {
  if (deploy.is_live) return "live";
  if (deploy.status === "completed") return "success";
  return "failed";
}

function DeployHistoryItem({ deploy }: { deploy: WebsiteDeployRecord }) {
  const rootPath = useRootPath();
  const [rolling, setRolling] = useState(false);

  const canRollback = deploy.revertible && !deploy.is_live && deploy.status === "completed";

  const handleRollback = useCallback(async () => {
    if (!confirm("Roll back to this deployment? The current live version will be replaced."))
      return;
    setRolling(true);
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
      const res = await fetch(`${rootPath}/api/v1/website_deploys/${deploy.id}/rollback`, {
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleRollback}
          disabled={rolling}
          className="gap-1.5"
        >
          <ArrowUturnLeftIcon className="size-3.5" />
          {rolling ? "Rolling back..." : "Rollback"}
        </Button>
      )}
    </div>
  );
}

export default function DeployHistory() {
  const { website_deploys } = usePage<DeployProps>().props;

  if (!website_deploys?.length) return null;

  // Separate current (live) from previous deploys
  const liveDeploy = website_deploys.find((d) => d.is_live);
  const previousDeploys = website_deploys.filter((d) => !d.is_live);

  return (
    <div className="flex flex-col gap-4 px-10 pb-7">
      {liveDeploy && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-base-500">Current</span>
          <div className="max-w-[580px]">
            <DeployHistoryItem deploy={liveDeploy} />
          </div>
        </div>
      )}
      {previousDeploys.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-base-400">Previous</span>
          <div className="flex flex-col gap-2 max-w-[580px]">
            {previousDeploys.map((d) => (
              <DeployHistoryItem key={d.id} deploy={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
