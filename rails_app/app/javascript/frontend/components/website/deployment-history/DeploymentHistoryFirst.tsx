import DeploymentHistoryCard from "./DeploymentHistoryCard";
import type { Deployment } from "./DeploymentHistory.types";

interface DeploymentHistoryFirstProps {
  deployment: Deployment;
}

export default function DeploymentHistoryFirst({ deployment }: DeploymentHistoryFirstProps) {
  return (
    <div className="flex size-full flex-col rounded-2xl border border-neutral-300 bg-white">
      {/* Header */}
      <div className="flex flex-col gap-0.5 px-10 pt-7">
        <h2 className="text-lg font-semibold leading-[22px] text-base-500">Deployment History</h2>
        <p className="text-xs leading-4 text-base-300">
          This page tracks all deployments for your landing page and ad campaigns. Review the status
          and details of each deployment to ensure optimal performance and quickly identify any
          issues.
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-10 pb-7">
        {/* TODO: Add Image Here */}
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-base-500">
              You've just launched your first campaign
            </h3>
            <p className="max-w-md text-sm leading-[18px] text-base-300">
              Your big idea is now out in the world and attracting customers. This is just the
              beginning of something amazing!
            </p>
          </div>
        </div>
        <div className="w-full max-w-[580px]">
          <DeploymentHistoryCard deployment={deployment} />
        </div>
      </div>
    </div>
  );
}
