import { useState, useCallback, useEffect } from "react";
import { Launch10SitePicker } from "./Launch10SitePicker";
import { CustomDomainPicker } from "./CustomDomainPicker";
import { FullUrlPreview } from "./FullUrlPreview";
import { useDomainContext } from "~/api/domainContext.hooks";
import { useWebsiteChatState, useWebsiteChatIsLoading } from "~/hooks/website/useWebsiteChat";
import { useWebsiteId } from "~/stores/projectStore";
import type { Website } from "@shared";

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

export interface DomainPickerProps {
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

export function DomainPicker({ onComplete, onBack }: DomainPickerProps) {
  const websiteId = useWebsiteId();
  const [showCustomDomain, setShowCustomDomain] = useState(false);
  const [selection, setSelection] = useState<DomainSelection | null>(null);

  // Fetch domain context from Rails (existing domains, credits)
  const {
    data: context,
    isLoading: isContextLoading,
    error: contextError,
  } = useDomainContext(websiteId ?? undefined);

  // Get AI recommendations from website graph state
  const domainRecommendations = useWebsiteChatState("domainRecommendations") as
    | Website.DomainRecommendations.DomainRecommendations
    | undefined;
  const isChatLoading = useWebsiteChatIsLoading();

  // Show loading state (context loading or chat still generating recommendations)
  const isLoading = isContextLoading || (isChatLoading && !domainRecommendations);

  // Handle selection from either picker mode
  const handleSelect = useCallback((newSelection: DomainSelection) => {
    setSelection(newSelection);
  }, []);

  // Auto-select top recommendation when it becomes available
  useEffect(() => {
    if (!selection && domainRecommendations?.topRecommendation) {
      const top = domainRecommendations.topRecommendation;
      setSelection({
        domain: top.domain,
        subdomain: top.subdomain,
        path: top.path,
        fullUrl: top.fullUrl,
        source: top.source,
        isNew: top.source === "generated",
        existingDomainId: top.existingDomainId,
      });
    }
  }, [selection, domainRecommendations]);

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

  // Show custom domain picker when triggered from dropdown
  if (showCustomDomain) {
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
        {/* Header */}
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold leading-[22px] text-base-500">Website Setup</h2>
          <p className="text-xs leading-4 text-base-300">
            Connect your own domain to your landing page
          </p>
        </div>

        <CustomDomainPicker
          selection={selection}
          onSelect={handleSelect}
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

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold leading-[22px] text-base-500">Website Setup</h2>
        <p className="text-xs leading-4 text-base-300">
          Choose how you want your website to be accessed
        </p>
      </div>

      {/* Launch10 Site Picker */}
      <Launch10SitePicker
        recommendations={domainRecommendations}
        context={context}
        selection={selection}
        onSelect={handleSelect}
        onConnectOwnSite={() => setShowCustomDomain(true)}
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
