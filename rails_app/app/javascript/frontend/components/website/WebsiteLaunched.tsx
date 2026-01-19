import { copyToClipboard } from "@helpers/copyToClipboard";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/16/solid";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function WebsiteLaunched({ domainUrl }: { domainUrl: string }) {
  const handleCopyUrl = async () => {
    await copyToClipboard(domainUrl ?? "");
  };

  const handleOpenUrl = () => {
    window.open(domainUrl, "_blank");
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold leading-[22px] text-base-500">
          Launch your landing page
        </h2>
        <p className="text-xs leading-4 text-base-300">
          Below is the current version of your live landing page.
        </p>
      </div>
      <div className="flex justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium leading-[18px] text-base-500">Current URL</span>
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
        <div className="flex items-center gap-1">
          <div className="rounded-full size-3 bg-success-500" />
          <span className="text-gray-800 text-sm font-medium">Live Site</span>
        </div>
      </div>
      <div className="h-screen">
        <DotLottieReact
          src="https://lottie.host/be5715ef-ec2a-45f6-9986-bef8d5053af2/OHxDypHifL.lottie"
          autoplay
        />
      </div>
    </div>
  );
}
