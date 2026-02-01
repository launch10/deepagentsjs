import { useState, useMemo } from "react";
import AwsLogo from "@assets/aws-logo.png";
import CloudflareLogo from "@assets/cloudflare-logo.png";
import GoDaddyLogo from "@assets/godaddy-logo.png";
import NamecheapLogo from "@assets/namecheap-logo.svg";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip";
import { copyToClipboard } from "@helpers/copyToClipboard";
import {
  ArrowTopRightOnSquareIcon,
  ArrowRightIcon,
  InformationCircleIcon,
} from "@heroicons/react/16/solid";
import {
  DocumentDuplicateIcon,
  XCircleIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { PageNameInput } from "./PageNameInput";
import { useCreateDomain } from "~/api/domainContext.hooks";
import { useDnsVerification } from "~/hooks/useDnsVerification";
import { useWebsiteId } from "~/stores/projectStore";
import type { BaseDomainPickerProps } from "./DomainPicker";

// ============================================================================
// Types
// ============================================================================

export interface CustomDomainPickerProps extends BaseDomainPickerProps {
  // onSwitchToLaunch10 is required for this component (inherited as optional, enforced here)
  onSwitchToLaunch10: () => void;
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
// Validation
// ============================================================================

const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

function validateDomain(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false };
  if (value.length > 253) return { valid: false, error: "Domain too long" };
  if (!DOMAIN_REGEX.test(value.toLowerCase())) {
    return { valid: false, error: "Enter a valid domain (e.g., example.com)" };
  }
  return { valid: true };
}

// ============================================================================
// Component
// ============================================================================

export function CustomDomainPicker({
  selection,
  onSelect,
  onSwitchToLaunch10,
}: CustomDomainPickerProps) {
  const websiteId = useWebsiteId();
  const [domain, setDomain] = useState(
    selection?.source === "custom" && !selection.domain.endsWith(".launch10.site")
      ? selection.domain
      : ""
  );
  const [path, setPath] = useState(selection?.path ?? "/");
  const [savedDomainId, setSavedDomainId] = useState<number | null>(null);

  // Domain creation mutation
  const createDomain = useCreateDomain();

  // DNS verification with auto-polling
  const {
    isVerified: isDnsVerified,
    isPending: isDnsPending,
    isFailed: isDnsFailed,
    error: dnsError,
    manualCheck,
  } = useDnsVerification(savedDomainId);

  // Validation
  const domainValidation = useMemo(() => validateDomain(domain), [domain]);

  // Handle domain change
  const handleDomainChange = (value: string) => {
    const sanitized = value.toLowerCase().trim();
    setDomain(sanitized);

    if (validateDomain(sanitized).valid) {
      updateSelection(sanitized, path);
    }
  };

  // Handle path change
  const handlePathChange = (newPath: string) => {
    setPath(newPath);
    if (domainValidation.valid) {
      updateSelection(domain, newPath);
    }
  };

  // Update selection
  const updateSelection = (dom: string, p: string) => {
    const normalizedPath = p === "/" ? "" : p;
    onSelect({
      domain: dom,
      subdomain: dom.split(".")[0],
      path: p,
      fullUrl: `${dom}${normalizedPath}`,
      source: "custom",
      isNew: true,
    });
  };

  const handleCopyPointsTo = async () => {
    await copyToClipboard("cname.launch10.ai");
  };

  // Save domain and start DNS verification
  const handleSaveDomain = async () => {
    if (!domainValidation.valid || !websiteId) return;

    try {
      const result = await createDomain.mutateAsync({
        domain,
        websiteId,
        isPlatformSubdomain: false,
      });
      setSavedDomainId(result.id);
    } catch (error) {
      console.error("Failed to create domain:", error);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Domain + Path Input Row */}
      <div className="flex flex-col gap-1">
        <div className="flex gap-4">
          {/* Domain Input */}
          <div className="flex-1 flex flex-col gap-2">
            <Label className="text-sm font-semibold leading-[18px] text-base-500">
              Your site name
            </Label>
            <Input
              type="text"
              value={domain}
              onChange={(e) => handleDomainChange(e.target.value)}
              placeholder="example.com"
              data-testid="custom-domain-input"
            />
            {domain && domainValidation.error && (
              <div className="flex items-center gap-1 text-xs text-destructive">
                <XCircleIcon className="size-3.5" />
                <span>{domainValidation.error}</span>
              </div>
            )}
            {domain && domainValidation.valid && !savedDomainId && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-success-500">
                  <CheckCircleIcon className="size-3.5" />
                  <span>Valid domain format</span>
                </div>
                <button
                  type="button"
                  onClick={handleSaveDomain}
                  disabled={createDomain.isPending}
                  className="text-xs text-primary-500 hover:text-primary-600 disabled:opacity-50"
                >
                  {createDomain.isPending ? "Saving..." : "Save & verify DNS"}
                </button>
              </div>
            )}
            {/* DNS Verification Status */}
            {savedDomainId && (
              <div className="mt-2" data-testid="dns-verification-status">
                {isDnsVerified ? (
                  <div className="flex items-center gap-2 text-success-500">
                    <CheckCircleIcon className="size-5" />
                    <span className="text-sm font-medium">DNS verified! Your domain is ready.</span>
                  </div>
                ) : isDnsPending ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-500">
                      <ClockIcon className="size-5 animate-pulse" />
                      <span className="text-sm">Waiting for DNS propagation...</span>
                    </div>
                    <button
                      type="button"
                      onClick={manualCheck}
                      className="text-xs text-primary-500 hover:text-primary-600"
                    >
                      Check now
                    </button>
                  </div>
                ) : isDnsFailed ? (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircleIcon className="size-5" />
                    <span className="text-sm">DNS verification failed: {dnsError}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Path Input */}
          <div className="flex-1 flex flex-col gap-2">
            <Label className="text-sm font-semibold leading-[18px] text-base-500 flex items-center gap-1">
              Page Name
              <Tooltip>
                <TooltipTrigger asChild>
                  <InformationCircleIcon className="size-4 text-base-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Optional - helps you group several pages within a single site. Example: /services
                  or /pricing
                </TooltipContent>
              </Tooltip>
            </Label>
            <PageNameInput value={path} onChange={handlePathChange} />
          </div>
        </div>

        {/* Switch to Launch10 Site */}
        <button
          type="button"
          onClick={onSwitchToLaunch10}
          className="flex items-center gap-2 text-sm text-base-500 hover:text-base-600 self-start p-2 underline"
        >
          <span>Use a Launch10 Site</span>
          <ArrowRightIcon className="size-4" />
        </button>
      </div>

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
            <div className="flex items-center gap-2">
              <p className="text-sm leading-[18px] text-base-500">cname.launch10.ai</p>
              <Tooltip delayDuration={500}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleCopyPointsTo}
                    className="text-base-400 hover:text-base-500"
                  >
                    <DocumentDuplicateIcon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Copy to clipboard</TooltipContent>
              </Tooltip>
            </div>
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
        </div>
      </div>
    </div>
  );
}
