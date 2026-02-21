import { Copyable } from "@components/ui/copyable";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/16/solid";
import { cn } from "@lib/utils";
import type { Deployment } from "./DeploymentHistory.types";
import DeploymentHistoryBadge from "./DeploymentHistoryBadge";

function deploymentHref(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

export default function DeploymentHistoryCard({ deployment }: { deployment: Deployment }) {
  const renderStatusIcon = () => {
    if (deployment.status === "success") {
      return <CheckCircleIcon className="size-4 text-success-700" />;
    }
    if (deployment.status === "failed") {
      return <ExclamationTriangleIcon className="size-4 text-secondary-700" />;
    }
    return null;
  };

  const renderStatusText = () => {
    switch (deployment.status) {
      case "success":
        return "Deployment Successful";
      case "failed":
        return "Deployment Failed";
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-white px-6 py-5 border-neutral-300",
        deployment.status === "failed" && "border-error-300",
        deployment.status === "success" && "border-success-300"
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          {/* Header row with status and tags */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {renderStatusIcon()}
              <span className="text-sm font-semibold text-base-500">{renderStatusText()}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {deployment.isNew && <DeploymentHistoryBadge variant="new" />}
              {deployment.isLive && <DeploymentHistoryBadge variant="live" />}
              {deployment.status === "success" && !deployment.isLive && (
                <DeploymentHistoryBadge variant="success" />
              )}
              {deployment.status === "failed" && <DeploymentHistoryBadge variant="failed" />}
            </div>
          </div>
          {/* Timestamp */}
          <span className="text-xs text-base-400">{deployment.timestamp}</span>
        </div>

        {/* Error message for failed deployments */}
        {deployment.status === "failed" && deployment.errorMessage && (
          <span className="text-sm text-base-500 opacity-80">{deployment.errorMessage}</span>
        )}

        <div className="flex flex-col gap-0">
          {/* Ad Group Name Link - only show for non-failed deployments */}
          {deployment.status !== "failed" && deployment.adGroupName && (
            <span className="text-sm text-primary-600 underline">{deployment.adGroupName}</span>
          )}

          {/* URL row - only show for non-failed deployments */}
          {deployment.status !== "failed" && deployment.url && (
            <Copyable text={deploymentHref(deployment.url)} className="mt-1 gap-2">
              <Copyable.Text className="text-sm text-base-500" />
              <Copyable.Trigger className="text-base-500 hover:text-base-600" />
              <a
                href={deploymentHref(deployment.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-base-500 transition-colors hover:text-base-600"
              >
                <ArrowTopRightOnSquareIcon className="size-3.5" />
              </a>
            </Copyable>
          )}
        </div>
      </div>
    </div>
  );
}
