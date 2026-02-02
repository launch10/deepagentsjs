import { useCallback } from "react";
import {
  InformationCircleIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { router } from "@inertiajs/react";
import { Label } from "@components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip";
import { Spinner } from "@components/ui/spinner";
import { SiteNameDropdown } from "./SiteNameDropdown";
import { PageNameInput } from "./PageNameInput";
import { DnsHelpSection } from "./DnsHelpSection";
import { FullUrlPreview } from "./FullUrlPreview";
import { ClaimSubdomainModal } from "./ClaimSubdomainModal";
import { useDomainAssignment } from "~/api/domainContext.hooks";
import { useWebsiteId } from "~/stores/projectStore";
import { useDirtySelection } from "~/hooks/useDirtySelection";
import { isPlatformDomain, getFullUrl } from "~/lib/domain";
import { useDomainPickerData, useClaimSubdomain, useSelectionInit } from "./hooks";
import { useDnsVerification } from "~/hooks/useDnsVerification";
import { useMinimumDuration } from "~/hooks/useMinimumDuration";

// ============================================================================
// Types
// ============================================================================

export type DomainOrigin = "existing" | "suggestion" | "user-input";

export interface WebsiteUrl {
  domain: string;
  path: string;
  origin: DomainOrigin;
  existingDomainId?: number;
}

export interface DomainPickerProps {
  /** Current selection (controlled) */
  selection: WebsiteUrl | null;
  /** Called when selection changes */
  onSelectionChange: (selection: WebsiteUrl | null) => void;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div data-testid="domain-picker-loading" className="flex flex-col gap-6 animate-pulse">
      <div className="h-12 bg-neutral-200 rounded-lg w-2/3" />
      <div className="h-10 bg-neutral-100 rounded-full w-1/3" />
      <div className="flex gap-4">
        <div className="flex-1 h-12 bg-neutral-100 rounded-lg" />
        <div className="flex-1 h-12 bg-neutral-100 rounded-lg" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-10 bg-neutral-100 rounded-lg" />
        <div className="h-10 bg-neutral-100 rounded-lg" />
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function DomainPicker({ selection, onSelectionChange }: DomainPickerProps) {
  const websiteId = useWebsiteId();

  // Data fetching
  const {
    context,
    recommendations,
    isLoading,
    error,
    assignedUrl,
    isOutOfCredits,
    creditsRemaining,
  } = useDomainPickerData(websiteId ?? undefined);

  // Dirty state tracking for blur-based saving
  const { isDirty, markPersisted } = useDirtySelection(
    selection,
    (a, b) => a.domain === b.domain && a.path === b.path
  );

  // Claim modal flow
  const claim = useClaimSubdomain({
    websiteId: websiteId ?? undefined,
    onClaimed: onSelectionChange,
    markPersisted,
  });

  // Domain assignment for auto-save
  const domainAssignment = useDomainAssignment(websiteId ?? undefined, 750);

  // Initialize selection from assigned URL or recommendations
  useSelectionInit({
    isLoading,
    assignedUrl,
    topRecommendation: recommendations?.topRecommendation,
    onSelectionChange,
    markPersisted,
  });

  // Derived values
  const selectedDomain = selection?.domain ?? null;
  const customPath = selection?.path ?? "/";
  const selectedRec = recommendations?.recommendations?.find((r) => r.domain === selectedDomain);

  // DNS verification for custom domains (only when we have a saved domain ID)
  const isCustomDomainWithId =
    selection && !isPlatformDomain(selection.domain) && selection.existingDomainId;
  const customDomainId = isCustomDomainWithId ? (selection.existingDomainId ?? null) : null;
  const {
    isVerified: isDnsVerified,
    isPending: isDnsPending,
    isFailed: isDnsFailed,
    isFetching: isDnsFetching,
    error: dnsError,
  } = useDnsVerification(customDomainId);

  // Show "checking" state with minimum 3 second duration for better UX
  const isShowingDnsCheck = useMinimumDuration(isDnsFetching, 3000);

  // Handle blur - triggers debounced save if dirty
  const handleBlur = useCallback(() => {
    if (!selection || !websiteId || !isDirty) return;
    if (!selection.existingDomainId && isPlatformDomain(selection.domain)) return;

    domainAssignment.mutateDebounced({
      domain: selection.domain,
      websiteId,
      path: selection.path,
      isPlatformSubdomain: isPlatformDomain(selection.domain),
    });
    markPersisted(selection);
  }, [selection, websiteId, isDirty, domainAssignment, markPersisted]);

  // Handle domain selection from dropdown
  const handleDomainSelect = useCallback(
    (domain: string, origin: DomainOrigin, existingDomainId?: number) => {
      const rec = recommendations?.recommendations?.find((r) => r.domain === domain);

      // Keep current path if user has already set one, otherwise use AI recommendation or default
      const currentPath = selection?.path;
      const hasUserSetPath = currentPath && currentPath !== "/";
      const newPath = hasUserSetPath ? currentPath : (rec?.path ?? "/");

      const newSelection: WebsiteUrl = {
        domain,
        path: newPath,
        origin,
        existingDomainId,
      };

      // Check if needs claim modal (platform subdomains that don't exist yet)
      if (claim.maybeClaim(newSelection)) return;

      onSelectionChange(newSelection);

      // Auto-save for existing domains OR custom domains entered by user
      const shouldAutoSave =
        origin === "existing" || (origin === "user-input" && !isPlatformDomain(domain));

      if (shouldAutoSave && websiteId) {
        domainAssignment.mutateDebounced({
          domain: newSelection.domain,
          websiteId,
          path: newSelection.path,
          isPlatformSubdomain: isPlatformDomain(newSelection.domain),
        });
        markPersisted(newSelection);
      }
    },
    [recommendations, websiteId, domainAssignment, markPersisted, onSelectionChange, claim]
  );

  // Handle path change - updates selection and triggers debounced save
  const handlePathChange = useCallback(
    (newPath: string) => {
      if (!selection) return;

      const newSelection: WebsiteUrl = { ...selection, path: newPath };

      if (claim.maybeClaim(newSelection)) return;

      onSelectionChange(newSelection);

      // Debounced save for path changes (skip if platform domain without existingDomainId - needs claim modal)
      const shouldAutoSave = selection.existingDomainId || !isPlatformDomain(selection.domain);

      if (shouldAutoSave && websiteId) {
        domainAssignment.mutateDebounced({
          domain: newSelection.domain,
          websiteId,
          path: newSelection.path,
          isPlatformSubdomain: isPlatformDomain(newSelection.domain),
        });
      }
    },
    [selection, onSelectionChange, claim, websiteId, domainAssignment]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
        <LoadingSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
        <div className="text-center py-8">
          <p className="text-destructive">Failed to load domain options. Please try again.</p>
        </div>
      </div>
    );
  }

  // Header text
  const isCustomDomain = selection && !isPlatformDomain(selection.domain);
  const title = isCustomDomain ? "Connect your own site" : "Website Setup";
  const subtitle = isCustomDomain
    ? "Use a site you already own, like mybusiness.com"
    : "Choose how you want your website to be accessed";

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold leading-[22px] text-base-500">{title}</h2>
        <p className="text-xs leading-4 text-base-300">{subtitle}</p>
      </div>

      {/* Out of Credits Warning */}
      {isOutOfCredits && (
        <div
          data-testid="out-of-credits-banner"
          className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3"
        >
          <ExclamationCircleIcon className="size-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            You've hit the limit of {context?.platform_subdomain_credits?.limit} subdomains allowed
            on your current subscription plan.{" "}
            <button
              type="button"
              onClick={() => router.visit("/settings")}
              className="font-medium text-amber-700 hover:text-amber-800 underline cursor-pointer"
            >
              Upgrade to add more.
            </button>
          </p>
        </div>
      )}

      {/* Domain + Path Selection Row */}
      <div className="flex gap-4">
        {/* Site Name (Domain) */}
        <div className="flex-1 flex flex-col gap-2">
          <Label className="text-sm font-semibold leading-[18px] text-base-500 flex items-center gap-1">
            Your site name
            <Tooltip>
              <TooltipTrigger asChild>
                <InformationCircleIcon className="size-4 text-base-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                This is where your landing page will live (e.g., mysite.launch10.site)
              </TooltipContent>
            </Tooltip>
          </Label>
          <SiteNameDropdown
            recommendations={recommendations}
            context={context}
            selectedDomain={selectedDomain}
            isOutOfCredits={isOutOfCredits}
            onSelect={handleDomainSelect}
          />
          {/* DNS Verification Status for custom domains - positioned like path availability */}
          {isCustomDomainWithId && (
            <div data-testid="dns-verification-status">
              {isShowingDnsCheck ? (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <Spinner className="size-3.5" />
                  <span>Checking if your site is directing users to launch10.ai...</span>
                </div>
              ) : isDnsVerified ? (
                <div className="flex items-center gap-1 text-xs text-success-500">
                  <CheckCircleIcon className="size-3.5" />
                  <span>Your domain is setup!</span>
                </div>
              ) : isDnsFailed ? (
                <div className="flex items-center gap-1 text-xs text-destructive">
                  <XCircleIcon className="size-3.5" />
                  <span>DNS verification failed: {dnsError}</span>
                </div>
              ) : isDnsPending ? (
                <div className="flex items-center gap-1 text-xs text-red-400">
                  <XCircleIcon className="size-3.5" />
                  <span>Not ready yet. We'll keep checking for you.</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Page Name (Path) */}
        <div className="flex-1 flex flex-col gap-2">
          <Label className="text-sm font-semibold leading-[18px] text-base-500 flex items-center gap-1">
            Page name
            <Tooltip>
              <TooltipTrigger asChild>
                <InformationCircleIcon className="size-4 text-base-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                Optional - helps you group several pages within a single site. Example: /services or
                /pricing
              </TooltipContent>
            </Tooltip>
          </Label>
          <PageNameInput
            value={customPath}
            onChange={handlePathChange}
            onBlur={handleBlur}
            domainId={selection?.existingDomainId}
            websiteId={websiteId ?? undefined}
            recommendedPath={selectedRec?.path}
          />
        </div>
      </div>

      {/* DNS Help Section - shown only for custom domains */}
      {selection && !isPlatformDomain(selection.domain) && <DnsHelpSection />}

      {/* Full URL Preview */}
      {selection && (
        <div className="pt-4 border-t border-neutral-200">
          <FullUrlPreview fullUrl={getFullUrl(selection.domain, selection.path)} />
        </div>
      )}

      {/* Claim Subdomain Modal */}
      <ClaimSubdomainModal
        isOpen={claim.showModal}
        onClose={claim.close}
        onConfirm={claim.confirm}
        domain={claim.pendingClaim?.domain ?? ""}
        creditsRemaining={creditsRemaining}
        isLoading={claim.isPending}
      />
    </div>
  );
}
