import { useState, useEffect, useMemo } from "react";
import { BoltIcon } from "@heroicons/react/24/solid";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@components/ui/item";
import { Label } from "@components/ui/label";
import { SiteNameDropdown } from "./SiteNameDropdown";
import { PageNameInput } from "./PageNameInput";
import type { Website } from "@shared";
import type { GetDomainContextResponse } from "@rails_api_base";
import type { DomainSelection } from "./DomainPicker";

// ============================================================================
// Types
// ============================================================================

export interface Launch10SitePickerProps {
  recommendations?: Website.DomainRecommendations.DomainRecommendations | null;
  context?: GetDomainContextResponse | null;
  selection: DomainSelection | null;
  onSelect: (selection: DomainSelection) => void;
}

// ============================================================================
// Component
// ============================================================================

export function Launch10SitePicker({
  recommendations,
  context,
  selection,
  onSelect,
}: Launch10SitePickerProps) {
  // Track which domain is selected in dropdown (may differ from final selection with path)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(
    selection?.domain ?? recommendations?.topRecommendation?.domain ?? null
  );
  const [customPath, setCustomPath] = useState(selection?.path ?? "/");

  // Determine if out of credits
  const isOutOfCredits = useMemo(() => {
    if (!context?.platform_subdomain_credits) return false;
    return context.platform_subdomain_credits.remaining === 0;
  }, [context]);

  // Get the selected recommendation details
  const selectedRec = useMemo(() => {
    if (!selectedDomain || !recommendations?.recommendations) return null;
    return recommendations.recommendations.find((r) => r.domain === selectedDomain);
  }, [selectedDomain, recommendations]);

  // Update path when domain selection changes
  useEffect(() => {
    if (selectedRec?.path && selectedRec.path !== customPath) {
      setCustomPath(selectedRec.path);
    }
  }, [selectedRec]);

  // Handle domain selection from dropdown
  const handleDomainSelect = (
    domain: string,
    subdomain: string,
    source: "existing" | "generated" | "custom",
    existingDomainId?: number
  ) => {
    setSelectedDomain(domain);

    // Find the recommendation to get the suggested path
    const rec = recommendations?.recommendations?.find((r) => r.domain === domain);
    const path = rec?.path ?? "/";
    setCustomPath(path);

    // Build full URL
    const normalizedPath = path === "/" ? "" : path;
    const fullUrl = `${domain}${normalizedPath}`;

    onSelect({
      domain,
      subdomain,
      path,
      fullUrl,
      source,
      isNew: source === "generated" || source === "custom",
      existingDomainId,
    });
  };

  // Handle path change
  const handlePathChange = (path: string) => {
    setCustomPath(path);

    if (selectedDomain && selection) {
      const normalizedPath = path === "/" ? "" : path;
      const fullUrl = `${selectedDomain}${normalizedPath}`;

      onSelect({
        ...selection,
        path,
        fullUrl,
      });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Info Banner */}
      <Item variant="outline" className="max-w-xl border-primary-300 bg-primary-100">
        <ItemMedia className="my-auto">
          <BoltIcon className="size-4 fill-primary-500" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Free & Instant</ItemTitle>
          <ItemDescription className="text-base-600">
            Get started immediately with a free Launch10 subdomain. Perfect for testing and
            launching quickly.
          </ItemDescription>
        </ItemContent>
      </Item>

      {/* Domain + Path Selection Row */}
      <div className="flex gap-4">
        {/* Site Name (Domain) */}
        <div className="flex-1 flex flex-col gap-2">
          <Label className="text-sm font-semibold leading-[18px] text-base-500">
            Your site name
          </Label>
          <SiteNameDropdown
            recommendations={recommendations}
            context={context}
            selectedDomain={selectedDomain}
            isOutOfCredits={isOutOfCredits}
            onSelect={handleDomainSelect}
          />
        </div>

        {/* Page Name (Path) */}
        <div className="flex-1 flex flex-col gap-2">
          <Label className="text-sm font-semibold leading-[18px] text-base-500">Page name</Label>
          <PageNameInput
            value={customPath}
            onChange={handlePathChange}
            existingDomainId={selectedRec?.existingDomainId}
            recommendedPath={selectedRec?.path}
          />
        </div>
      </div>

      {/* Out of Credits Warning */}
      {isOutOfCredits && (
        <div
          data-testid="out-of-credits-banner"
          className="flex flex-col gap-2 rounded-md bg-amber-50 border border-amber-200 px-4 py-3"
        >
          <p className="text-sm text-amber-800">
            You've used all your free subdomains. Upgrade to create more, or reuse an existing site.
          </p>
          <a
            href="/subscriptions"
            className="text-sm font-medium text-amber-700 hover:text-amber-800 underline self-start"
          >
            Upgrade your plan
          </a>
        </div>
      )}
    </div>
  );
}
