import { useState, useEffect, useMemo } from "react";
import {
  InformationCircleIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { Label } from "@components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip";
import { SiteNameDropdown } from "./SiteNameDropdown";
import { PageNameInput } from "./PageNameInput";
import { useWebsiteId } from "~/stores/projectStore";
import type { Website } from "@shared";
import type { BaseDomainPickerProps } from "./DomainPicker";

// ============================================================================
// Types
// ============================================================================

type AvailabilityStatus = "checking" | "available" | "unavailable" | "deployed" | null;

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
  onConnectOwnSite,
}: Launch10SitePickerProps) {
  const websiteId = useWebsiteId();

  // Track which domain is selected in dropdown (may differ from final selection with path)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(
    selection?.domain ?? recommendations?.topRecommendation?.domain ?? null
  );
  const [customPath, setCustomPath] = useState(selection?.path ?? "/");

  // Track URL availability status
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(null);

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

  // Check availability when selection changes
  useEffect(() => {
    if (!selection?.domain || !selection?.path) {
      setAvailabilityStatus(null);
      return;
    }

    // Check if this is an existing deployed URL
    const existingDomain = context?.existing_domains?.find((d) => d.domain === selection.domain);
    if (existingDomain) {
      const existingUrl = existingDomain.website_urls.find((u) => u.path === selection.path);
      // If this URL exists and has a website_id, it might be deployed
      if (existingUrl && existingUrl.website_id) {
        // For now, mark as available since we need is_deployed flag from backend
        // TODO: Add is_deployed flag to website_urls response
        setAvailabilityStatus("available");
        return;
      }
    }

    // For new domains/paths, mark as available (already verified by AI or search)
    setAvailabilityStatus("available");
  }, [selection, context]);

  // Handle domain selection from dropdown
  const handleDomainSelect = (
    domain: string,
    subdomain: string,
    source: "existing" | "generated" | "custom",
    existingDomainId?: number
  ) => {
    console.log("[Launch10SitePicker] handleDomainSelect called:", { domain, subdomain, source, existingDomainId });
    setSelectedDomain(domain);

    // Find the recommendation to get the suggested path
    const rec = recommendations?.recommendations?.find((r) => r.domain === domain);
    const path = rec?.path ?? "/";
    setCustomPath(path);

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
    };
    console.log("[Launch10SitePicker] calling onSelect with:", newSelection);
    onSelect(newSelection);
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
            <a
              href="/settings"
              className="font-medium text-amber-700 hover:text-amber-800 underline"
            >
              Upgrade to add more.
            </a>
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
            onConnectOwnSite={onConnectOwnSite}
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
            domainId={selectedRec?.existingDomainId}
            websiteId={websiteId ?? undefined}
            recommendedPath={selectedRec?.path}
          />
        </div>
      </div>

      {/* Availability Status */}
      {selection && availabilityStatus && (
        <div className="mt-2" data-testid="availability-status">
          {availabilityStatus === "available" && (
            <div className="flex items-center gap-1.5 text-sm text-success-500">
              <CheckCircleIcon className="size-4" />
              <span>Available: {selection.fullUrl}</span>
            </div>
          )}
          {availabilityStatus === "unavailable" && (
            <div className="flex items-center gap-1.5 text-sm text-destructive">
              <XCircleIcon className="size-4" />
              <span>Selected website is currently unavailable</span>
            </div>
          )}
          {availabilityStatus === "deployed" && (
            <div className="flex items-center gap-1.5 text-sm text-destructive">
              <ExclamationCircleIcon className="size-4" />
              <span>
                This site is currently launched. Please choose a different site that isn't already
                taken.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
