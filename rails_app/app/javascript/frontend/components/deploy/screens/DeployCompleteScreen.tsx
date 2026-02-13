import { CheckCircleIcon, GlobeAltIcon } from "@heroicons/react/24/solid";
import type { Deploy } from "@shared";

interface DeployCompleteScreenProps {
  deployType: "website" | "campaign";
  result?: Deploy.DeployGraphState["result"];
  domain?: string | null;
}

export default function DeployCompleteScreen({
  deployType,
  result,
  domain,
}: DeployCompleteScreenProps) {
  const isCampaign = deployType === "campaign";
  const deployUrl = result?.url as string | undefined;
  const displayUrl = deployUrl || domain;

  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
      <div className="max-w-lg w-full">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
            <CheckCircleIcon className="size-10 text-success-500" />
          </div>
          <h2 className="text-xl font-semibold text-base-900">
            {isCampaign ? "Campaign Launched!" : "Website Launched!"}
          </h2>
        </div>

        <div className="border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-base-700">Deployment History</h3>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center text-xs font-medium text-success-700 bg-success-50 border border-success-200 rounded-full px-2 py-0.5">
                Live
              </span>
              {isCampaign && (
                <span className="inline-flex items-center text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-full px-2 py-0.5">
                  Ads Enabled
                </span>
              )}
            </div>
          </div>

          {displayUrl && (
            <a
              href={displayUrl.startsWith("http") ? displayUrl : `https://${displayUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
            >
              <GlobeAltIcon className="size-4" />
              <span className="underline">{displayUrl}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
