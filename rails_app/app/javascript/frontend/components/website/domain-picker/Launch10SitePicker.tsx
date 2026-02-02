import { useMemo } from "react";
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
import { useWebsiteId } from "~/stores/projectStore";
import type { BaseDomainPickerProps } from "./DomainPicker";

// ============================================================================
// Types
// ============================================================================

export interface Launch10SitePickerProps extends BaseDomainPickerProps {
  // All props inherited from BaseDomainPickerProps
}

// ============================================================================
// Component
// ============================================================================

export function Launch10SitePicker({
  recommendations,
  context,
  selection,
  onSelect,
  onBlur,
}: Launch10SitePickerProps) {
  const websiteId = useWebsiteId();

  // FULLY CONTROLLED: Derive display values from selection prop, no local state to sync
  const selectedDomain = selection?.domain ?? null;
  const customPath = selection?.path ?? "/";

  // Determine if out of credits
  const isOutOfCredits = useMemo(() => {
    if (!context?.platform_subdomain_credits) return false;
    const result = context.platform_subdomain_credits.remaining === 0;
    console.log("[Launch10SitePicker] isOutOfCredits:", result, "credits:", context.platform_subdomain_credits);
    return result;
  }, [context]);

  // Get the selected recommendation details
  const selectedRec = useMemo(() => {
    if (!selectedDomain || !recommendations?.recommendations) return null;
    return recommendations.recommendations.find((r) => r.domain === selectedDomain);
  }, [selectedDomain, recommendations]);

  // Handle domain selection from dropdown
  const handleDomainSelect = (
    domain: string,
    subdomain: string,
    source: "existing" | "generated" | "custom",
    existingDomainId?: number,
    isPlatformSubdomain?: boolean
  ) => {

    // Find the recommendation to get the suggested path
    const rec = recommendations?.recommendations?.find((r) => r.domain === domain);
    const path = rec?.path ?? "/";

    // Build full URL
    const normalizedPath = path === "/" ? "" : path;
    const fullUrl = `${domain}${normalizedPath}`;

    const newSelection = {
      domain,
      subdomain,
      path,
      fullUrl,
      source,
      isNew: source === "generated" || source === "custom",
      existingDomainId,
      isPlatformSubdomain: isPlatformSubdomain ?? domain.endsWith(".launch10.site"),
    };
    onSelect(newSelection);

    // Trigger save after domain selection (if it's an existing domain)
    // New domains will go through the claim modal which saves immediately
    if (source === "existing") {
      // Small delay to let the selection update before triggering save
      setTimeout(() => onBlur?.(), 0);
    }
  };

  // Handle path change
  const handlePathChange = (newPath: string) => {
    if (selectedDomain && selection) {
      const normalizedPath = newPath === "/" ? "" : newPath;
      const fullUrl = `${selectedDomain}${normalizedPath}`;

      onSelect({
        ...selection,
        path: newPath,
        fullUrl,
      });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Out of Credits Warning - shown at top */}
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
            onBlur={onBlur}
            domainId={selection?.existingDomainId}
            websiteId={websiteId ?? undefined}
            recommendedPath={selectedRec?.path}
          />
        </div>
      </div>

      {/* DNS Help Section - shown only for custom domains (not .launch10.site) */}
      {selection && !selection.domain.endsWith(".launch10.site") && (
        <DnsHelpSection domainId={selection.existingDomainId ?? null} />
      )}
    </div>
  );
}
