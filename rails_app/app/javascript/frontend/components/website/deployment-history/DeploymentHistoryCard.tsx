import { Badge } from "@components/ui/badge";
import { copyToClipboard } from "@helpers/copyToClipboard";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/16/solid";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { cn } from "@lib/utils";
import type { Deployment } from "./DeploymentHistory.types";

export default function DeploymentHistoryCard({ deployment }: { deployment: Deployment }) {
  const handleCopyUrl = async () => {
    if (deployment.url) {
      await copyToClipboard(deployment.url);
    }
  };

  const handleOpenUrl = () => {
    // TODO: Open URL in new tab
  };

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

  const renderBadges = () => {
    const badges = [];

    if (deployment.isNew) {
      badges.push(
        <Badge key="new" className="border-none bg-success-500 text-white">
          New
        </Badge>
      );
    }

    if (deployment.isLive) {
      badges.push(
        <Badge key="live" className="border-none bg-success-100 text-success-700">
          Live
        </Badge>
      );
    }

    // Show Success badge for successful deployments that aren't marked as new/live
    if (deployment.status === "success" && !deployment.isNew && !deployment.isLive) {
      badges.push(
        <Badge key="success" className="border-none bg-success-100 text-success-700">
          Success
        </Badge>
      );
    }

    if (deployment.status === "failed") {
      badges.push(
        <Badge key="failed" className="border-none bg-error-100 text-secondary-700">
          Failed
        </Badge>
      );
    }

    return badges;
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
            <div className="flex items-center gap-2">{renderBadges()}</div>
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
            <div className="flex items-center gap-2 mt-1 text-base-500">
              <span className="text-sm text-base-500">{deployment.url}</span>
              <button
                onClick={handleCopyUrl}
                className="text-base-500 transition-colors hover:text-base-600"
                aria-label="Copy URL"
              >
                <DocumentDuplicateIcon className="size-3.5" />
              </button>
              <button
                onClick={handleOpenUrl}
                className="text-base-500 transition-colors hover:text-base-600"
                aria-label="Open URL in new tab"
              >
                <ArrowTopRightOnSquareIcon className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
