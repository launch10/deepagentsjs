import { Button } from "@components/ui/button";
import { CheckCircleIcon } from "@heroicons/react/16/solid";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/16/solid";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { copyToClipboard } from "~/helpers/copyToClipboard";

interface WebsiteLaunchProps {
  domainUrl?: string;
  onLaunch?: () => void;
  onCopyUrl?: () => void;
  onOpenUrl?: () => void;
}

export default function WebsiteLaunch({
  domainUrl = "#",
  onLaunch,
  onCopyUrl,
  onOpenUrl,
}: WebsiteLaunchProps) {
  const handleCopyUrl = async () => {
    await copyToClipboard(domainUrl ?? "");
  };

  const handleOpenUrl = () => {
    window.open(domainUrl, "_blank");
    onOpenUrl?.();
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold leading-[22px] text-base-500">
          Launch your landing page
        </h2>
        <p className="text-xs leading-4 text-base-300">
          Review the details below and click Launch when you're ready to go live.
        </p>
      </div>
      <div className="min-w-[580px] mx-auto flex flex-col gap-5 justify-center">
        {/* TODO: Add illustration */}
        <div className="rounded-lg border border-[#96CEB8] bg-white px-6 py-5">
          <div className="flex flex-col gap-5">
            {/* Checklist */}
            <div className="flex flex-col gap-2">
              <ChecklistItem label="Business Idea Analyzed" />
              <ChecklistItem label="Landing Page Brought to Life" />
              <ChecklistItem label="Domain Linked & Ready" />
            </div>
            {/* Domain URL */}
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium leading-[18px] text-base-500">Domain URL</span>
              <div className="flex items-center gap-2 opacity-80">
                <span className="text-sm leading-[18px] text-base-500">{domainUrl}</span>
                <button
                  onClick={handleCopyUrl}
                  className="text-base-500 hover:text-base-600 transition-colors"
                  aria-label="Copy URL"
                >
                  <DocumentDuplicateIcon className="size-3.5" />
                </button>
                <button
                  onClick={handleOpenUrl}
                  className="text-base-500 hover:text-base-600 transition-colors"
                  aria-label="Open URL in new tab"
                >
                  <ArrowTopRightOnSquareIcon className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <Button className="min-w-[300px] mx-auto" onClick={onLaunch}>
          Launch Landing Page
        </Button>
      </div>
    </div>
  );
}

function ChecklistItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1">
      <CheckCircleIcon className="size-4 text-success-700" />
      <span className="text-sm font-medium leading-[18px] text-base-500">{label}</span>
    </div>
  );
}
