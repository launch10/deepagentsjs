import { useState } from "react";
import { CheckCircleIcon, CheckIcon, GlobeAltIcon, PlusCircleIcon } from "@heroicons/react/24/outline";
import { copyToClipboard } from "@helpers/copyToClipboard";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip";
import { cn } from "~/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface FullUrlPreviewProps {
  fullUrl: string;
  isNew: boolean;
  source: "existing" | "generated" | "custom";
}

// ============================================================================
// Component
// ============================================================================

export function FullUrlPreview({ fullUrl, isNew, source }: FullUrlPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = fullUrl.startsWith("http") ? fullUrl : `https://${fullUrl}`;
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine status label
  const statusLabel = isNew ? "New page" : "Existing domain";
  const StatusIcon = isNew ? PlusCircleIcon : CheckCircleIcon;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {/* Globe Icon */}
        <div
          className={cn(
            "flex items-center justify-center size-10 rounded-full",
            isNew ? "bg-primary-100" : "bg-success-100"
          )}
        >
          <GlobeAltIcon className={cn("size-5", isNew ? "text-primary-500" : "text-success-500")} />
        </div>

        {/* URL and Status */}
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-base-600" data-testid="full-url-display">
            https://{fullUrl}
          </span>
          <div className="flex items-center gap-1 text-xs text-base-400">
            <StatusIcon className="size-3.5" />
            <span>{statusLabel}</span>
            {source === "custom" && <span className="text-base-300">- Custom domain</span>}
          </div>
        </div>
      </div>

      {/* Copy Button */}
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
              copied
                ? "text-success-600"
                : "text-base-500 hover:text-base-600 hover:bg-neutral-100"
            )}
          >
            {copied ? (
              <CheckIcon className="size-4" />
            ) : (
              <DocumentDuplicateIcon className="size-4" />
            )}
            <span>{copied ? "Copied!" : "Copy URL"}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied!" : "Copy to clipboard"}</TooltipContent>
      </Tooltip>
    </div>
  );
}
