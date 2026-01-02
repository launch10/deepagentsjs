import DeploymentHistoryCard from "./DeploymentHistoryCard";
import type { Deployment } from "./DeploymentHistory.types";

interface DeploymentHistoryProps {
  deployments?: Deployment[];
}

export default function DeploymentHistory({ deployments = [] }: DeploymentHistoryProps) {
  // Separate deployments into current (first one with isNew or isLive) and previous (the rest)
  const currentDeployment = deployments.find((d) => d.isNew || d.isLive);
  const previousDeployments = deployments.filter((d) => d !== currentDeployment);

  return (
    <div className="flex size-full flex-col rounded-2xl border border-neutral-300 bg-white py-7 px-10">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold leading-[22px] text-base-500">Deployment History</h2>
        <p className="text-xs text-base-300">
          This page tracks all deployments for your landing page and ad campaigns. Review the status
          and details of each deployment to ensure optimal performance and quickly identify any
          issues.
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-7 pt-10 pb-7">
        {/* Current Section */}
        {currentDeployment && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-base-500">Current</span>
            <div className="flex flex-col max-w-[580px]">
              <DeploymentHistoryCard deployment={currentDeployment} />
            </div>
          </div>
        )}

        {/* Previous Section */}
        {previousDeployments.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="text-sm text-base-400">Previous</span>
            <div className="flex flex-col gap-2 max-w-[580px]">
              {previousDeployments.map((deployment) => (
                <DeploymentHistoryCard key={deployment.id} deployment={deployment} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
