import { CheckCircleIcon, CheckIcon, GlobeAltIcon, PlusCircleIcon } from "@heroicons/react/24/outline";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { Copyable } from "@components/ui/copyable";
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
  // Determine status label
  const statusLabel = isNew ? "New page" : "Existing domain";
  const StatusIcon = isNew ? PlusCircleIcon : CheckCircleIcon;
  const copyUrl = fullUrl.startsWith("http") ? fullUrl : `https://${fullUrl}`;

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
      <Copyable text={copyUrl}>
        <Copyable.Trigger
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
            "text-base-500 hover:text-base-600 hover:bg-neutral-100"
          )}
        >
          {({ copied }) => (
            <>
              {copied ? (
                <CheckIcon className="size-4" />
              ) : (
                <DocumentDuplicateIcon className="size-4" />
              )}
              <span>{copied ? "Copied!" : "Copy URL"}</span>
            </>
          )}
        </Copyable.Trigger>
      </Copyable>
    </div>
  );
}
