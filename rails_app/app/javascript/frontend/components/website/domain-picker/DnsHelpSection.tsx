import { router } from "@inertiajs/react";
import { Copyable } from "@components/ui/copyable";
import {
  ArrowTopRightOnSquareIcon,
  ArrowRightIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/16/solid";
import { DNS_PROVIDERS, CNAME_TARGET } from "~/lib/constants/dnsProviders";

// ============================================================================
// Component
// ============================================================================

/**
 * DNS Help Section - Shows CNAME instructions and provider guides for custom domains.
 * DNS verification status is shown inline under the domain dropdown in DomainPicker.
 */
export function DnsHelpSection() {
  return (
    <div className="flex flex-col gap-4 mt-4">
      {/* What you need - CNAME Instructions */}
      <div className="bg-neutral-50 rounded-lg px-4 py-5">
        <p className="text-xs font-semibold leading-4 text-base-500 mb-2">What you need</p>
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-1 w-20">
            <p className="text-xs font-medium leading-4 text-base-400">Record Name</p>
            <p className="text-sm leading-[18px] text-base-500">CNAME</p>
          </div>
          <div className="flex flex-col gap-1 w-20">
            <p className="text-xs font-medium leading-4 text-base-400">Host</p>
            <p className="text-sm leading-[18px] text-base-500">www</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium leading-4 text-base-400">Points to</p>
            <Copyable text={CNAME_TARGET}>
              <Copyable.Text className="text-sm leading-[18px] text-base-500" />
              <Copyable.Trigger className="size-3.5" />
            </Copyable>
          </div>
        </div>
      </div>

      {/* DNS Provider Guides */}
      <div className="border border-neutral-300 rounded-lg px-4 py-5">
        <div className="flex flex-col gap-1 mb-4">
          <p className="text-sm font-medium leading-[18px] text-base-600">
            Guides for common providers
          </p>
          <p className="text-xs leading-4 text-base-400">
            We've prepared guides for popular DNS providers
          </p>
        </div>
        <div className="flex flex-wrap gap-x-7 gap-y-4">
          {DNS_PROVIDERS.map((provider) => (
            <div key={provider.name} className="flex flex-col gap-0 w-32">
              <div className="flex items-center gap-1">
                {provider.logo}
                <span className="text-sm font-semibold leading-[18px] text-base-600">
                  {provider.name}
                </span>
              </div>
              <a
                href={provider.guideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs leading-4 text-primary-500 hover:text-primary-600"
              >
                <span>View official guide</span>
                <ArrowTopRightOnSquareIcon className="size-4" />
              </a>
            </div>
          ))}
          <div className="flex flex-col gap-0 w-32">
            <div className="flex items-center gap-1">
              <QuestionMarkCircleIcon className="size-4 text-base-400" />
              <span className="text-sm font-semibold leading-[18px] text-base-600">Other</span>
            </div>
            <button
              type="button"
              onClick={() => router.visit("/support")}
              className="flex items-center gap-1 text-xs leading-4 text-primary-500 hover:text-primary-600 text-left"
            >
              <span>Get help</span>
              <ArrowRightIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
