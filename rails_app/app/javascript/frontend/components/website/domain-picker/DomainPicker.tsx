import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  InformationCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { router } from "@inertiajs/react";
import { Label } from "@components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip";
import { SiteNameDropdown } from "./SiteNameDropdown";
import { PageNameInput } from "./PageNameInput";
import { DnsHelpSection } from "./DnsHelpSection";
import { FullUrlPreview } from "./FullUrlPreview";
import { ClaimSubdomainModal } from "./ClaimSubdomainModal";
import { useDomainContext, useDomainAssignment } from "~/api/domainContext.hooks";
import { useWebsiteChatState } from "~/hooks/website/useWebsiteChat";
import { useWebsiteId } from "~/stores/projectStore";
import { isPlatformDomain, getSubdomain, getFullUrl } from "~/lib/domain";
import type { Website } from "@shared";

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
  /** Current selection (controlled) - if provided, component is controlled */
  selection?: WebsiteUrl | null;
  /** Called when selection changes */
  onSelectionChange?: (selection: WebsiteUrl | null) => void;
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

export function DomainPicker({
  selection: controlledSelection,
  onSelectionChange,
}: DomainPickerProps) {
  const websiteId = useWebsiteId();
  const [hasInitialized, setHasInitialized] = useState(false);
  const [internalSelection, setInternalSelection] = useState<WebsiteUrl | null>(null);

  // Claim subdomain modal state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [pendingClaim, setPendingClaim] = useState<WebsiteUrl | null>(null);

  // Track the last persisted selection to detect changes that need saving
  const lastPersistedSelection = useRef<WebsiteUrl | null>(null);

  // Domain assignment mutation with debounce + cancel pattern
  const domainAssignment = useDomainAssignment(websiteId ?? undefined, 750);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledSelection !== undefined;
  const selection = isControlled ? controlledSelection : internalSelection;

  // Fetch domain context from Rails (existing domains, credits, assigned URL)
  const {
    data: context,
    isLoading: isContextLoading,
    error: contextError,
  } = useDomainContext(websiteId ?? undefined);

  // The assigned URL is the source of truth - comes directly from website.website_url
  const assignedUrl = context?.assigned_url ?? null;

  // Get AI recommendations from website graph state
  const domainRecommendations = useWebsiteChatState("domainRecommendations") as
    | Website.DomainRecommendations.DomainRecommendations
    | undefined;

  // Derive display values from selection
  const selectedDomain = selection?.domain ?? null;
  const customPath = selection?.path ?? "/";

  // Determine if out of credits
  const isOutOfCredits = useMemo(() => {
    if (!context?.platform_subdomain_credits) return false;
    return context.platform_subdomain_credits.remaining === 0;
  }, [context]);

  // Get the selected recommendation details (for recommended path hint)
  const selectedRec = useMemo(() => {
    if (!selectedDomain || !domainRecommendations?.recommendations) return null;
    return domainRecommendations.recommendations.find((r) => r.domain === selectedDomain);
  }, [selectedDomain, domainRecommendations]);

  // Get credits remaining for the modal
  const creditsRemaining = context?.platform_subdomain_credits?.remaining ?? 0;

  // Check if a selection requires claiming a new platform subdomain
  const needsClaimModal = useCallback(
    (sel: WebsiteUrl): boolean => {
      // Only show modal for NEW platform subdomains (uses a credit)
      return !sel.existingDomainId && isPlatformDomain(sel.domain);
    },
    []
  );

  // Check if the selection has changed from the last persisted state
  const hasSelectionChanged = useCallback(
    (current: WebsiteUrl | null): boolean => {
      if (!current) return false;
      const last = lastPersistedSelection.current;
      if (!last) return true;
      return current.domain !== last.domain || current.path !== last.path;
    },
    []
  );

  // Commit selection to local state (UI-only, no API call)
  const commitSelection = useCallback(
    (newSelection: WebsiteUrl) => {
      if (isControlled) {
        onSelectionChange?.(newSelection);
      } else {
        setInternalSelection(newSelection);
      }
    },
    [isControlled, onSelectionChange]
  );

  // Handle blur - triggers debounced save if selection has changed
  const handleBlur = useCallback(() => {
    if (!selection || !websiteId || !hasSelectionChanged(selection)) return;
    if (needsClaimModal(selection)) return;

    domainAssignment.mutateDebounced({
      domain: selection.domain,
      websiteId,
      path: selection.path,
      isPlatformSubdomain: isPlatformDomain(selection.domain),
    });

    lastPersistedSelection.current = selection;
  }, [selection, websiteId, hasSelectionChanged, needsClaimModal, domainAssignment]);

  // Handle selection from the picker
  const handleSelect = useCallback(
    (newSelection: WebsiteUrl) => {
      if (needsClaimModal(newSelection)) {
        setPendingClaim(newSelection);
        setShowClaimModal(true);
        return;
      }
      commitSelection(newSelection);
    },
    [needsClaimModal, commitSelection]
  );

  // Handle domain selection from dropdown
  const handleDomainSelect = useCallback(
    (domain: string, origin: DomainOrigin, existingDomainId?: number) => {
      // Find the recommendation to get the suggested path
      const rec = domainRecommendations?.recommendations?.find((r) => r.domain === domain);
      const path = rec?.path ?? "/";

      const newSelection: WebsiteUrl = {
        domain,
        path,
        origin,
        existingDomainId,
      };

      handleSelect(newSelection);

      // Trigger save immediately for existing domains
      // Note: We can't use handleBlur here because it reads `selection` from closure,
      // which won't have the new value yet (stale closure issue). Instead, save directly.
      if (origin === "existing" && websiteId && !needsClaimModal(newSelection)) {
        domainAssignment.mutateDebounced({
          domain: newSelection.domain,
          websiteId,
          path: newSelection.path,
          isPlatformSubdomain: isPlatformDomain(newSelection.domain),
        });
        lastPersistedSelection.current = newSelection;
      }
    },
    [domainRecommendations, handleSelect, websiteId, needsClaimModal, domainAssignment]
  );

  // Handle path change
  const handlePathChange = useCallback(
    (newPath: string) => {
      if (selectedDomain && selection) {
        handleSelect({
          ...selection,
          path: newPath,
        });
      }
    },
    [selectedDomain, selection, handleSelect]
  );

  // Handle claim confirmation from modal (immediate save)
  const handleClaimConfirm = useCallback(async () => {
    if (!pendingClaim || !websiteId) return;

    try {
      const result = await domainAssignment.mutateNowAsync({
        domain: pendingClaim.domain,
        websiteId,
        path: pendingClaim.path,
        isPlatformSubdomain: true,
      });

      const claimedSelection: WebsiteUrl = {
        ...pendingClaim,
        origin: "existing",
        existingDomainId: result.id,
      };

      commitSelection(claimedSelection);
      lastPersistedSelection.current = claimedSelection;
      setShowClaimModal(false);
      setPendingClaim(null);
    } catch (error) {
      console.error("Failed to claim subdomain:", error);
    }
  }, [pendingClaim, websiteId, domainAssignment, commitSelection]);

  // Handle claim modal close
  const handleClaimClose = useCallback(() => {
    setShowClaimModal(false);
    setPendingClaim(null);
  }, []);

  // Initialize selection from assigned URL or AI recommendations
  useEffect(() => {
    if (hasInitialized || isContextLoading) return;

    // Priority 1: If website has an assigned URL, use it
    if (assignedUrl) {
      const newSelection: WebsiteUrl = {
        domain: assignedUrl.domain,
        path: assignedUrl.path ?? "/",
        origin: "existing",
        existingDomainId: assignedUrl.domain_id,
      };

      if (isControlled) {
        onSelectionChange?.(newSelection);
      } else {
        setInternalSelection(newSelection);
      }
      lastPersistedSelection.current = newSelection;
      setHasInitialized(true);
      return;
    }

    // Priority 2: Use AI recommendation
    if (context && domainRecommendations?.topRecommendation) {
      const top = domainRecommendations.topRecommendation;

      const newSelection: WebsiteUrl = {
        domain: top.domain,
        path: top.path,
        origin: top.source, // "existing" | "suggestion" from backend
        existingDomainId: top.existingDomainId,
      };

      if (isControlled) {
        onSelectionChange?.(newSelection);
      } else {
        setInternalSelection(newSelection);
      }
      setHasInitialized(true);
    }
  }, [hasInitialized, isContextLoading, assignedUrl, context, domainRecommendations, isControlled, onSelectionChange]);

  // Loading state
  if (isContextLoading) {
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
        <LoadingSkeleton />
      </div>
    );
  }

  // Error state
  if (contextError) {
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
        <div className="text-center py-8">
          <p className="text-destructive">Failed to load domain options. Please try again.</p>
        </div>
      </div>
    );
  }

  // Derive header text based on whether a custom domain is selected
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
            recommendations={domainRecommendations}
            context={context}
            selectedDomain={selectedDomain}
            isOutOfCredits={isOutOfCredits}
            onSelect={handleDomainSelect}
          />
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
      {selection && !isPlatformDomain(selection.domain) && (
        <DnsHelpSection domainId={selection.existingDomainId ?? null} />
      )}

      {/* Full URL Preview */}
      {selection && (
        <div className="pt-4 border-t border-neutral-200">
          <FullUrlPreview fullUrl={getFullUrl(selection.domain, selection.path)} />
        </div>
      )}

      {/* Claim Subdomain Modal */}
      <ClaimSubdomainModal
        isOpen={showClaimModal}
        onClose={handleClaimClose}
        onConfirm={handleClaimConfirm}
        domain={pendingClaim?.domain ?? ""}
        creditsRemaining={creditsRemaining}
        isLoading={domainAssignment.isPending}
      />
    </div>
  );
}
