import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import DeploymentHistoryCard from "@components/website/deployment-history/DeploymentHistoryCard";
import type { Deployment } from "@components/website/deployment-history/DeploymentHistory.types";
import { DeployHistory } from "@components/deploy";
import { Button } from "@components/ui/button";
import DevButton from "@components/shared/DevButton";
import FullResetButton from "@components/deploy/FullResetButton";
import { useDeployId } from "~/stores/projectStore";
import { useDeployChatState, useDeployNewDeploy, type DeployProps } from "@hooks/useDeployChat";
import deployImage from "@assets/deploy.png";

function RestartDeployButton() {
  const deployId = useDeployId();
  const [restarting, setRestarting] = useState(false);

  const handleRestart = useCallback(async () => {
    if (!deployId) return;
    if (
      !confirm("Restart deploy? This deletes the current deploy so Langgraph creates a fresh one.")
    )
      return;

    setRestarting(true);
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
      await fetch(`/test/deploys/${deployId}/restart`, {
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
  }, [deployId]);

  return (
    <DevButton onClick={handleRestart} disabled={restarting}>
      {restarting ? "Restarting..." : "Restart Deploy (Dev)"}
    </DevButton>
  );
}

function NewDeployButton() {
  const { trigger, isLoading } = useDeployNewDeploy();

  const handleNewDeploy = useCallback(async () => {
    if (!confirm("Start a new deployment?")) return;
    trigger();
  }, [trigger]);

  return (
    <Button onClick={handleNewDeploy} disabled={isLoading} variant="outline">
      {isLoading ? "Starting..." : "Redeploy"}
    </Button>
  );
}

function buildDeployUrl(baseUrl: string | undefined, environment?: string): string | undefined {
  if (!baseUrl) return undefined;
  if (!environment || environment === "production") return baseUrl;
  const full = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  const url = new URL(full);
  url.searchParams.set("cloudEnv", environment);
  return url.toString();
}

const CAMPAIGN_TASK_NAMES: string[] = [
  "ConnectingGoogle",
  "VerifyingGoogle",
  "CheckingBilling",
  "DeployingCampaign",
  "EnablingCampaign",
];

export default function DeployCompleteScreen() {
  const { website_url, deploy_environment } = usePage<DeployProps>().props;
  const result = useDeployChatState("result");
  const tasks = useDeployChatState("tasks");
  const nothingChanged = useDeployChatState("nothingChanged");
  const hasCampaign = (tasks ?? []).some((t) => CAMPAIGN_TASK_NAMES.includes(t.name));
  const rawUrl = (result?.url as string | undefined) || website_url || undefined;
  const deployUrl = buildDeployUrl(rawUrl, deploy_environment ?? undefined);

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
            {hasCampaign ? " and ad campaigns" : ""}. Review the status and details of each
            deployment to ensure optimal performance and quickly identify any issues.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <FullResetButton />
          <RestartDeployButton />
          <NewDeployButton />
        </div>
      </div>

      {/* Success banner — optical center (1/3 from top) */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-10">
        <img src={deployImage} alt="Deployment" className="w-40 sm:w-56" />
        <div className="flex flex-col items-center gap-3 text-center">
          <h3 className="text-xl font-semibold text-base-500">
            {nothingChanged
              ? "Everything is already up to date"
              : hasCampaign
                ? "You've just launched your first campaign"
                : "You've just launched your website"}
          </h3>
          <p className="max-w-md text-sm leading-[18px] text-base-300">
            {nothingChanged
              ? "No changes were detected since your last deployment. Your website and campaigns are running the latest version."
              : "Your big idea is now out in the world and attracting customers. This is just the beginning of something amazing!"}
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
