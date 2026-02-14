import type { Deploy } from "@shared";
import DeploymentHistoryCard from "@components/website/deployment-history/DeploymentHistoryCard";
import type { Deployment } from "@components/website/deployment-history/DeploymentHistory.types";
import { DeployHistory } from "@components/deploy";
import deployImage from "@assets/deploy.png";

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
      <div className="flex flex-col gap-0.5 px-10 pt-7">
        <h2 className="text-lg font-semibold leading-[22px] text-base-500">Deployment History</h2>
        <p className="text-xs leading-4 text-base-300">
          This page tracks all deployments for your landing page
          {isCampaign ? " and ad campaigns" : ""}. Review the status and details of each deployment
          to ensure optimal performance and quickly identify any issues.
        </p>
      </div>

      {/* Success banner */}
      <div className="flex flex-col items-center px-10 pt-6 pb-4">
        <img src={deployImage} alt="Deployment" className="w-20" />
        <div className="flex flex-col items-center gap-1.5 pt-3 pb-4 text-center">
          <h3 className="text-base font-semibold text-base-500">
            {isCampaign
              ? "You've just launched your first campaign"
              : "You've just launched your website"}
          </h3>
          <p className="max-w-md text-sm leading-[18px] text-base-300">
            Your big idea is now out in the world and attracting customers. This is just the
            beginning of something amazing!
          </p>
        </div>
        <div className="w-full">
          <DeploymentHistoryCard deployment={deployment} />
        </div>
      </div>

      {/* Deploy history */}
      <DeployHistory />
    </div>
  );
}
