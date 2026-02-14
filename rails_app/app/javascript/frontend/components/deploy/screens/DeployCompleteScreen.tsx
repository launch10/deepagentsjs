import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import type { Deploy } from "@shared";
import DeploymentHistoryCard from "@components/website/deployment-history/DeploymentHistoryCard";
import type { Deployment } from "@components/website/deployment-history/DeploymentHistory.types";
import { DeployHistory } from "@components/deploy";
import { Button } from "@components/ui/button";
import DevButton from "@components/shared/DevButton";
import type { DeployProps } from "@hooks/useDeployChat";
import { useRootPath } from "~/stores/sessionStore";
import deployImage from "@assets/deploy.png";

function RestartDeployButton() {
  const { deploy } = usePage<DeployProps>().props;
  const [restarting, setRestarting] = useState(false);

  const handleRestart = useCallback(async () => {
    if (!deploy?.id) return;
    if (!confirm("Restart deploy? This deletes the deploy chat and resets to pending.")) return;

    setRestarting(true);
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
      await fetch(`/test/deploys/${deploy.id}/restart`, {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": csrfToken || "",
          Accept: "application/json",
        },
      });
      window.location.reload();
    } catch (e) {
      console.error("Failed to restart deploy:", e);
      setRestarting(false);
    }
  }, [deploy?.id]);

  return (
    <DevButton onClick={handleRestart} disabled={restarting}>
      {restarting ? "Restarting..." : "Restart Deploy (Dev)"}
    </DevButton>
  );
}

function NewDeployButton() {
  const { project } = usePage<DeployProps>().props;
  const rootPath = useRootPath();
  const [creating, setCreating] = useState(false);

  const handleNewDeploy = useCallback(async () => {
    if (!confirm("Start a new deployment?")) return;
    setCreating(true);
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
      await fetch(`${rootPath}/api/v1/deploys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || "",
        },
        credentials: "include",
        body: JSON.stringify({ project_id: project.id }),
      });
      window.location.reload();
    } catch {
      setCreating(false);
    }
  }, [project.id, rootPath]);

  return (
    <Button onClick={handleNewDeploy} disabled={creating} variant="outline">
      {creating ? "Starting..." : "Redeploy"}
    </Button>
  );
}

interface DeployCompleteScreenProps {
  deployType: "website" | "campaign";
  result?: Deploy.DeployGraphState["result"];
  websiteUrl?: string | null;
  deployEnvironment?: string;
}

function buildDeployUrl(baseUrl: string | undefined, environment?: string): string | undefined {
  if (!baseUrl) return undefined;
  if (!environment || environment === "production") return baseUrl;
  const full = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  const url = new URL(full);
  url.searchParams.set("cloudEnv", environment);
  return url.toString();
}

export default function DeployCompleteScreen({
  deployType,
  result,
  websiteUrl,
  deployEnvironment,
}: DeployCompleteScreenProps) {
  const isCampaign = deployType === "campaign";
  const rawUrl = (result?.url as string | undefined) || websiteUrl || undefined;
  const deployUrl = buildDeployUrl(rawUrl, deployEnvironment);

  const deployment: Deployment = {
    id: "current",
    status: "success",
    isNew: true,
    isLive: true,
    timestamp: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    url: deployUrl,
  };

  return (
    <div className="flex size-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-10 pt-7">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold leading-[22px] text-base-500">Deployment History</h2>
          <p className="text-xs leading-4 text-base-300">
            This page tracks all deployments for your landing page
            {isCampaign ? " and ad campaigns" : ""}. Review the status and details of each
            deployment to ensure optimal performance and quickly identify any issues.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <RestartDeployButton />
          <NewDeployButton />
        </div>
      </div>

      {/* Success banner — optical center (1/3 from top) */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-10">
        <img src={deployImage} alt="Deployment" className="w-56" />
        <div className="flex flex-col items-center gap-3 text-center">
          <h3 className="text-xl font-semibold text-base-500">
            {isCampaign
              ? "You've just launched your first campaign"
              : "You've just launched your website"}
          </h3>
          <p className="max-w-md text-sm leading-[18px] text-base-300">
            Your big idea is now out in the world and attracting customers. This is just the
            beginning of something amazing!
          </p>
        </div>
      </div>

      {/* Deployment card + history pinned to bottom */}
      <div className="mt-auto px-10 pb-4">
        <DeploymentHistoryCard deployment={deployment} />
      </div>

      {/* Deploy history */}
      <DeployHistory />
    </div>
  );
}
