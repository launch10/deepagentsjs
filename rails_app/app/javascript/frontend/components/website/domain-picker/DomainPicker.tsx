import { useState, useCallback, useEffect, useMemo } from "react";
import { Launch10SitePicker } from "./Launch10SitePicker";
import { CustomDomainPicker } from "./CustomDomainPicker";
import { FullUrlPreview } from "./FullUrlPreview";
import { useDomainContext } from "~/api/domainContext.hooks";
import { useWebsiteChatState, useWebsiteChatIsLoading } from "~/hooks/website/useWebsiteChat";
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

  // Support both controlled and uncontrolled modes
  const isControlled = controlledSelection !== undefined;
  const selection = isControlled ? controlledSelection : internalSelection;

  // Fetch domain context from Rails (existing domains, credits, assigned URL)
  const {
    data: context,
    isLoading: isContextLoading,
    error: contextError,
  } = useDomainContext(websiteId ?? undefined);

  // The assigned URL is the source of truth - comes directly from website.website_urls
  const assignedUrl = context?.assigned_url ?? null;

  // Get AI recommendations from website graph state
  const domainRecommendations = useWebsiteChatState("domainRecommendations") as
    | Website.DomainRecommendations.DomainRecommendations
    | undefined;
  const isChatLoading = useWebsiteChatIsLoading();

  // Show loading state (context loading or chat still generating recommendations)
  const isLoading = isContextLoading || (isChatLoading && !domainRecommendations);

  // Handle selection from either picker mode
  const handleSelect = useCallback(
    (newSelection: DomainSelection) => {
      console.log("[DomainPicker] handleSelect called:", { newSelection, isControlled });
      if (isControlled) {
        onSelectionChange?.(newSelection);
      } else {
        setInternalSelection(newSelection);
      }
    },
    [isControlled, onSelectionChange]
  );

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

      console.log("[DomainPicker] Initializing from assigned URL:", newSelection);

      // Set view mode based on domain type
      if (!assignedUrl.is_platform_subdomain) {
        setShowCustomDomain(true);
      }

      // Set selection
      if (isControlled) {
        onSelectionChange?.(newSelection);
      } else {
        setInternalSelection(newSelection);
      }

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

      console.log("[DomainPicker] Initializing from AI recommendation:", newSelection);

      if (isControlled) {
        onSelectionChange?.(newSelection);
      } else {
        setInternalSelection(newSelection);
      }

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

  // // Show custom domain picker when triggered from dropdown
  // if (showCustomDomain) {
  //   return (
  //     <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
  //       {/* Header */}
  //       <div className="flex flex-col gap-0.5">
  //         <h2 className="text-lg font-semibold leading-[22px] text-base-500">Website Setup</h2>
  //         <p className="text-xs leading-4 text-base-300">
  //           Connect your own domain to your landing page
  //         </p>
  //       </div>

  //       <CustomDomainPicker
  //         selection={selection}
  //         onSelect={handleSelect}
  //         onSwitchToLaunch10={() => setShowCustomDomain(false)}
  //       />

  //       {/* Full URL Preview */}
  //       {selection && (
  //         <div className="pt-4 border-t border-neutral-200">
  //           <FullUrlPreview
  //             fullUrl={selection.fullUrl}
  //             isNew={selection.isNew}
  //             source={selection.source}
  //           />
  //         </div>
  //       )}
  //     </div>
  //   );
  // }
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
        onConnectOwnSite={() => setShowCustomDomain(true)}
        onSwitchToLaunch10={() => setShowCustomDomain(false)}
      />

      {/* Full URL Preview */}
      {selection && (
        <div className="pt-4 border-t border-neutral-200">
          <FullUrlPreview
            fullUrl={selection.fullUrl}
            isNew={selection.isNew}
            source={selection.source}
          />
        </div>
      )}
    </div>
  );
}
