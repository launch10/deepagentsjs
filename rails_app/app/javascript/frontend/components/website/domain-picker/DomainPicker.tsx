import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Launch10SitePicker } from "./Launch10SitePicker";
import { CustomDomainPicker } from "./CustomDomainPicker";
import { FullUrlPreview } from "./FullUrlPreview";
import { ClaimSubdomainModal } from "./ClaimSubdomainModal";
import { useDomainContext, useDomainAssignment } from "~/api/domainContext.hooks";
import { useWebsiteChatState } from "~/hooks/website/useWebsiteChat";
import { useWebsiteId } from "~/stores/projectStore";
import type { Website } from "@shared";
import type { GetDomainContextResponse } from "@rails_api_base";


// ============================================================================
// Types
// ============================================================================

export interface DomainSelection {
  domain: string;
  subdomain: string;
  path: string;
  fullUrl: string;
  source: "existing" | "generated" | "custom";
  isNew: boolean;
  existingDomainId?: number;
}

/**
 * Base props shared by Launch10SitePicker and CustomDomainPicker.
 * Allows switching between pickers with the same prop object.
 */
export interface BaseDomainPickerProps {
  selection: DomainSelection | null;
  onSelect: (selection: DomainSelection) => void;
  /** Called when user finishes editing (blur) - triggers debounced save */
  onBlur?: () => void;
  // Navigation between picker modes
  onConnectOwnSite?: () => void;
  onSwitchToLaunch10?: () => void;
  // Context (used by Launch10SitePicker, ignored by CustomDomainPicker)
  recommendations?: Website.DomainRecommendations.DomainRecommendations | null;
  context?: import("@rails_api_base").GetDomainContextResponse | null;
}

export interface DomainPickerProps {
  /** Current selection (controlled) - if provided, component is controlled */
  selection?: DomainSelection | null;
  /** Called when selection changes */
  onSelectionChange?: (selection: DomainSelection | null) => void;
  /** @deprecated Use selection + onSelectionChange instead */
  onComplete?: (selection: DomainSelection) => void;
  onBack?: () => void;
}

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

export function DomainPicker({
  selection: controlledSelection,
  onSelectionChange,
  onComplete,
  onBack,
}: DomainPickerProps) {
  const websiteId = useWebsiteId();
  const [showCustomDomain, setShowCustomDomain] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [internalSelection, setInternalSelection] = useState<DomainSelection | null>(null);

  // Claim subdomain modal state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [pendingClaim, setPendingClaim] = useState<DomainSelection | null>(null);

  // Track the last persisted selection to detect changes that need saving
  const lastPersistedSelection = useRef<DomainSelection | null>(null);

  // Domain assignment mutation with debounce + cancel pattern
  // Uses useLatestMutation for blur-to-save behavior
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

  // Log key data for debugging
  if (context) {
    console.log("[DomainPicker] Rails context:", {
      credits: context.platform_subdomain_credits,
      assignedUrl: context.assigned_url,
      existingDomains: context.existing_domains?.length,
    });
  }

  // Get AI recommendations from website graph state
  const domainRecommendations = useWebsiteChatState("domainRecommendations") as
    | Website.DomainRecommendations.DomainRecommendations
    | undefined;

  // Show loading state ONLY while Rails context is loading.
  // We don't block on AI recommendations - the domain picker can work without them.
  // Users can select existing domains, enter custom subdomains, etc.
  // AI recommendations will populate the dropdown when they arrive.
  const isLoading = isContextLoading;

  // Get credits remaining for the modal
  const creditsRemaining = context?.platform_subdomain_credits?.remaining ?? 0;

  // Check if a selection requires claiming a new platform subdomain
  const requiresClaimModal = useCallback(
    (newSelection: DomainSelection): boolean => {
      // Only show modal for NEW platform subdomains (uses a credit)
      const isPlatformSubdomain = newSelection.domain.endsWith(".launch10.site");
      const isNewSubdomain = newSelection.isNew && (newSelection.source === "generated" || newSelection.source === "custom");
      return isPlatformSubdomain && isNewSubdomain;
    },
    []
  );

  // Check if the selection has changed from the last persisted state
  const hasSelectionChanged = useCallback(
    (current: DomainSelection | null): boolean => {
      if (!current) return false;
      const last = lastPersistedSelection.current;
      if (!last) return true;
      return current.domain !== last.domain || current.path !== last.path;
    },
    []
  );

  // Actually commit the selection to local state (UI-only, no API call)
  const commitSelection = useCallback(
    (newSelection: DomainSelection) => {
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

    // Don't save if it requires the claim modal (new subdomain)
    if (requiresClaimModal(selection)) return;

    domainAssignment.mutateDebounced({
      domain: selection.domain,
      websiteId,
      path: selection.path,
      isPlatformSubdomain: selection.domain.endsWith(".launch10.site"),
    });

    // Update the last persisted selection
    lastPersistedSelection.current = selection;
  }, [selection, websiteId, hasSelectionChanged, requiresClaimModal, domainAssignment]);

  // Handle selection from either picker mode (UI-only, no API call)
  const handleSelect = useCallback(
    (newSelection: DomainSelection) => {

      const isCustomDomain = !newSelection.domain.endsWith(".launch10.site");

      // If selecting a custom domain, switch to custom view
      if (isCustomDomain) {
        setShowCustomDomain(true);
        commitSelection(newSelection);
        return;
      }

      // Check if we need to show the claim modal (new platform subdomain uses a credit)
      if (requiresClaimModal(newSelection)) {
        setPendingClaim(newSelection);
        setShowClaimModal(true);
        return;
      }

      // For all other cases, just update local selection (API call on blur)
      commitSelection(newSelection);
    },
    [isControlled, requiresClaimModal, commitSelection]
  );

  // Handle claim confirmation from modal (immediate save)
  const handleClaimConfirm = useCallback(async () => {
    if (!pendingClaim || !websiteId) return;

    try {
      // Use mutateNowAsync for immediate save (cancels any pending debounced saves)
      const result = await domainAssignment.mutateNowAsync({
        domain: pendingClaim.domain,
        websiteId,
        path: pendingClaim.path,
        isPlatformSubdomain: true,
      });

      // Update the selection with the new domain ID
      const claimedSelection: DomainSelection = {
        ...pendingClaim,
        isNew: false, // No longer new once claimed
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

  // Single initialization effect: sets both view mode AND initial selection atomically
  useEffect(() => {
    if (hasInitialized || isContextLoading) return;

    // Priority 1: If website has an assigned URL, use it
    if (assignedUrl) {
      const path = assignedUrl.path ?? "/";
      const normalizedPath = path === "/" ? "" : path;

      // Extract subdomain for platform subdomains
      let subdomain = "";
      if (assignedUrl.is_platform_subdomain && assignedUrl.domain.endsWith(".launch10.site")) {
        subdomain = assignedUrl.domain.replace(".launch10.site", "");
      }

      const newSelection: DomainSelection = {
        domain: assignedUrl.domain,
        subdomain,
        path,
        fullUrl: `${assignedUrl.domain}${normalizedPath}`,
        source: "existing",
        isNew: false,
        existingDomainId: assignedUrl.domain_id,
      };

      // Set view mode based on domain type
      if (!assignedUrl.is_platform_subdomain) {
        setShowCustomDomain(true);
      }

      // Set selection and track as persisted (already saved on server)
      if (isControlled) {
        onSelectionChange?.(newSelection);
      } else {
        setInternalSelection(newSelection);
      }
      lastPersistedSelection.current = newSelection;

      setHasInitialized(true);
      return;
    }

    // Priority 2: Use AI recommendation (only when context loaded but no assigned URL)
    if (context && domainRecommendations?.topRecommendation) {
      const top = domainRecommendations.topRecommendation;
      const newSelection: DomainSelection = {
        domain: top.domain,
        subdomain: top.subdomain,
        path: top.path,
        fullUrl: top.fullUrl,
        source: top.source,
        isNew: top.source === "generated",
        existingDomainId: top.existingDomainId,
      };

      if (isControlled) {
        onSelectionChange?.(newSelection);
      } else {
        setInternalSelection(newSelection);
      }
      // Note: AI recommendations are NOT yet persisted - will save on blur

      setHasInitialized(true);
    }
  }, [hasInitialized, isContextLoading, assignedUrl, context, domainRecommendations, isControlled, onSelectionChange]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
        <LoadingSkeleton />
      </div>
    );
  }

  if (contextError) {
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
        <div className="text-center py-8">
          <p className="text-destructive">Failed to load domain options. Please try again.</p>
        </div>
      </div>
    );
  }

  const title = showCustomDomain ? "Connect your own site" : "Website Setup";
  const subtitle = showCustomDomain ? "Use a site you already own, like mybusiness.com" : "Choose how you want your website to be accessed";
  const DomainPickerComponent = showCustomDomain ? CustomDomainPicker : Launch10SitePicker;

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold leading-[22px] text-base-500">{title}</h2>
        <p className="text-xs leading-4 text-base-300">{subtitle}</p>
      </div>

      <DomainPickerComponent
        recommendations={domainRecommendations}
        context={context}
        selection={selection}
        onSelect={handleSelect}
        onBlur={handleBlur}
        onConnectOwnSite={() => setShowCustomDomain(true)}
        onSwitchToLaunch10={() => setShowCustomDomain(false)}
      />

      {/* Full URL Preview */}
      {selection && (
        <div className="pt-4 border-t border-neutral-200">
          <FullUrlPreview fullUrl={selection.fullUrl} />
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
