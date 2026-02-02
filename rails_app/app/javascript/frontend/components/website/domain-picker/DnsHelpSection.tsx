import { useState, useEffect, useRef } from "react";
import { router } from "@inertiajs/react";
import AwsLogo from "@assets/aws-logo.png";
import CloudflareLogo from "@assets/cloudflare-logo.png";
import GoDaddyLogo from "@assets/godaddy-logo.png";
import NamecheapLogo from "@assets/namecheap-logo.svg";
import { Copyable } from "@components/ui/copyable";
import {
  ArrowTopRightOnSquareIcon,
  ArrowRightIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/16/solid";
import {
  XCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { Spinner } from "@components/ui/spinner";
import { useDnsVerification } from "~/hooks/useDnsVerification";

// ============================================================================
// Types
// ============================================================================

export interface DnsHelpSectionProps {
  /** Domain ID for DNS verification polling. If null, only shows instructions. */
  domainId: number | null;
}

interface DnsProvider {
  name: string;
  logo?: React.ReactNode;
  guideUrl: string;
}

const DNS_PROVIDERS: DnsProvider[] = [
  {
    name: "Cloudflare",
    logo: <img src={CloudflareLogo} alt="Cloudflare" className="w-4" />,
    guideUrl: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
  },
  {
    name: "GoDaddy",
    logo: <img src={GoDaddyLogo} alt="GoDaddy" className="w-4" />,
    guideUrl: "https://www.godaddy.com/help/add-a-cname-record-19236",
  },
  {
    name: "Namecheap",
    logo: <img src={NamecheapLogo} alt="Namecheap" className="w-4" />,
    guideUrl:
      "https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/",
  },
  {
    name: "AWS Route 53",
    logo: <img src={AwsLogo} alt="AWS Route 53" className="w-4" />,
    guideUrl:
      "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html",
  },
];

// ============================================================================
// Component
// ============================================================================

/**
 * DNS Help Section - Shows DNS verification status, CNAME instructions,
 * and provider guides for custom domains.
 */
export function DnsHelpSection({ domainId }: DnsHelpSectionProps) {
  // DNS verification with auto-polling (polls every 10s until verified)
  const {
    isVerified: isDnsVerified,
    isPending: isDnsPending,
    isFailed: isDnsFailed,
    isFetching: isDnsFetching,
    error: dnsError,
  } = useDnsVerification(domainId);

  // Show "checking" state with minimum 3 second duration for better UX
  const [isShowingCheck, setIsShowingCheck] = useState(false);
  const checkStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isDnsFetching && !isShowingCheck) {
      // Start showing check state
      setIsShowingCheck(true);
      checkStartTimeRef.current = Date.now();
    } else if (!isDnsFetching && isShowingCheck && checkStartTimeRef.current) {
      // Fetching done - ensure minimum 3 second display
      const elapsed = Date.now() - checkStartTimeRef.current;
      const remaining = Math.max(0, 3000 - elapsed);

      const timer = setTimeout(() => {
        setIsShowingCheck(false);
        checkStartTimeRef.current = null;
      }, remaining);

      return () => clearTimeout(timer);
    }
  }, [isDnsFetching, isShowingCheck]);

  return (
    <div className="flex flex-col gap-4 mt-4">
      {/* DNS Verification Status - only show if we have a saved domain */}
      {domainId && (
        <div data-testid="dns-verification-status">
          {isShowingCheck ? (
            // Checking state (shown for minimum 3 seconds)
            <div className="flex items-center gap-2 text-amber-600">
              <Spinner className="size-4" />
              <span className="text-sm">Checking if your site is directing users to launch10.ai...</span>
            </div>
          ) : isDnsVerified ? (
            // Verified - show success
            <div className="flex items-center gap-2 text-success-500">
              <CheckCircleIcon className="size-5" />
              <span className="text-sm font-medium">Your domain is setup!</span>
            </div>
          ) : isDnsFailed ? (
            // Failed - show error
            <div className="flex items-center gap-2 text-destructive">
              <XCircleIcon className="size-5" />
              <span className="text-sm">DNS verification failed: {dnsError}</span>
            </div>
          ) : isDnsPending ? (
            // Pending (not yet configured) - show X until next check
            <div className="flex items-center gap-2 text-red-400">
              <XCircleIcon className="size-5" />
              <span className="text-sm">Not ready yet. We'll keep checking for you.</span>
            </div>
          ) : null}
        </div>
      )}

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
            <Copyable text="cname.launch10.ai">
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
              <span className="text-sm font-semibold leading-[18px] text-base-600">
                Other
              </span>
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
