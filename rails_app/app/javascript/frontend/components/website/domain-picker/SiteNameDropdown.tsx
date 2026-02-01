import { useState, useMemo, useCallback } from "react";
import {
  ChevronDownIcon,
  StarIcon,
  CheckIcon,
  LinkIcon,
  LockClosedIcon,
} from "@heroicons/react/24/solid";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { cn } from "~/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover";
import { Input } from "@components/ui/input";
import type { Website } from "@shared";
import type { GetDomainContextResponse } from "@rails_api_base";

// ============================================================================
// Types
// ============================================================================

export interface SiteNameDropdownProps {
  recommendations?: Website.DomainRecommendations.DomainRecommendations | null;
  context?: GetDomainContextResponse | null;
  selectedDomain: string | null;
  isOutOfCredits: boolean;
  onSelect: (
    domain: string,
    subdomain: string,
    source: "existing" | "generated" | "custom",
    existingDomainId?: number
  ) => void;
  onConnectOwnSite?: () => void;
}

const PLATFORM_SUFFIX = ".launch10.site";

// ============================================================================
// Validation
// ============================================================================

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function validateSubdomain(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false };
  if (value.length > 63) return { valid: false, error: "Max 63 characters" };
  if (!SUBDOMAIN_REGEX.test(value)) {
    return { valid: false, error: "Only lowercase letters, numbers, and hyphens" };
  }
  if (value.startsWith("-") || value.endsWith("-")) {
    return { valid: false, error: "Cannot start or end with hyphen" };
  }
  return { valid: true };
}

// ============================================================================
// Component
// ============================================================================

export function SiteNameDropdown({
  recommendations,
  context,
  selectedDomain,
  isOutOfCredits,
  onSelect,
  onConnectOwnSite,
}: SiteNameDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");

  // Parse recommendations into existing and generated
  const existingSites = useMemo(() => {
    if (!recommendations?.recommendations) return [];
    return recommendations.recommendations.filter((r) => r.source === "existing");
  }, [recommendations]);

  const suggestedSites = useMemo(() => {
    if (!recommendations?.recommendations) return [];
    return recommendations.recommendations.filter((r) => r.source === "generated");
  }, [recommendations]);

  // Check if a domain is the top recommendation
  const isTopRecommendation = useCallback(
    (domain: string) => {
      return recommendations?.topRecommendation?.domain === domain;
    },
    [recommendations]
  );

  // Get display name for selected domain
  const selectedDisplayName = useMemo(() => {
    if (!selectedDomain) return "Select a domain...";
    return selectedDomain.replace(PLATFORM_SUFFIX, "");
  }, [selectedDomain]);

  // Handle selecting a domain from the dropdown
  const handleSelect = (
    domain: string,
    subdomain: string,
    source: "existing" | "generated",
    existingDomainId?: number
  ) => {
    onSelect(domain, subdomain, source, existingDomainId);
    setIsOpen(false);
  };

  // Handle custom subdomain submission
  const handleCustomSubmit = () => {
    const subdomain = customInput.toLowerCase().trim();
    const validation = validateSubdomain(subdomain);
    if (!validation.valid) return;

    const domain = `${subdomain}${PLATFORM_SUFFIX}`;
    onSelect(domain, subdomain, "custom");
    setIsOpen(false);
    setCustomInput("");
  };

  const customValidation = validateSubdomain(customInput.toLowerCase().trim());

  // Check if user can connect custom domains (Growth or Pro plan)
  const canConnectCustomDomain = context?.plan_tier === "growth" || context?.plan_tier === "pro";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between gap-2",
            "rounded-md border border-neutral-300 bg-white px-3 py-2",
            "text-sm text-left transition-colors",
            "hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          )}
        >
          <span className="flex items-center gap-2">
            <span className={selectedDomain ? "text-base-600" : "text-base-400"}>
              {selectedDisplayName}
            </span>
            {/* Only show suffix when a domain is selected */}
            {selectedDomain && <span className="text-base-400">{PLATFORM_SUFFIX}</span>}
          </span>
          <ChevronDownIcon className="size-4 text-base-400" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="max-h-80 overflow-y-auto">
          {/* Create New Site Section - Always at top */}
          <div className="p-2">
            <div className="px-2 py-1.5 text-xs font-medium text-base-400">Create New Site</div>
            <div className="relative">
              <Input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value.toLowerCase())}
                placeholder="Type to create your own"
                className={cn("text-sm", customInput && "pr-28")}
                disabled={isOutOfCredits}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customValidation.valid) {
                    handleCustomSubmit();
                  }
                }}
              />
              {/* Show suffix only when input has value */}
              {customInput && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-base-400 pointer-events-none">
                  {PLATFORM_SUFFIX}
                </span>
              )}
            </div>
            {customInput && customValidation.error && (
              <p className="text-xs text-destructive mt-1 px-1">{customValidation.error}</p>
            )}
          </div>

          {/* Existing Sites Section */}
          {existingSites.length > 0 && (
            <>
              <div className="border-t border-neutral-200" />
              <div className="p-1">
                <div className="px-2 py-1.5 text-xs font-medium text-base-400">
                  Your Existing Sites
                </div>
                {existingSites.map((site) => {
                  const websiteName = context?.existing_domains?.find(
                    (d) => d.domain === site.domain
                  )?.website_name;

                  return (
                    <button
                      key={site.domain}
                      type="button"
                      onClick={() =>
                        handleSelect(site.domain, site.subdomain, "existing", site.existingDomainId)
                      }
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-2 rounded text-sm text-left",
                        "hover:bg-neutral-100 transition-colors",
                        selectedDomain === site.domain && "bg-primary-50"
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-base-600">
                            {site.subdomain}
                            <span className="text-base-400">{PLATFORM_SUFFIX}</span>
                          </span>
                          {isTopRecommendation(site.domain) && (
                            <span
                              data-testid={`recommendation-star-${site.domain}`}
                              className="inline-flex items-center gap-0.5 text-xs text-amber-600"
                            >
                              <StarIcon className="size-3 fill-amber-400" />
                              <span>Recommended</span>
                            </span>
                          )}
                        </div>
                        {websiteName && (
                          <span className="text-xs text-base-400">From: {websiteName}</span>
                        )}
                      </div>
                      {selectedDomain === site.domain && (
                        <CheckIcon className="size-4 text-primary-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Suggested Sites Section */}
          {suggestedSites.length > 0 && (
            <>
              <div className="border-t border-neutral-200" />
              <div className="p-1">
                <div className="px-2 py-1.5 text-xs font-medium text-base-400">
                  Create New Site (Suggestions)
                </div>
                {suggestedSites.map((site) => (
                  <button
                    key={site.domain}
                    type="button"
                    disabled={isOutOfCredits}
                    onClick={() => handleSelect(site.domain, site.subdomain, "generated")}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2 rounded text-sm text-left",
                      "hover:bg-neutral-100 transition-colors",
                      selectedDomain === site.domain && "bg-primary-50",
                      isOutOfCredits && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-base-600">
                          {site.subdomain}
                          <span className="text-base-400">{PLATFORM_SUFFIX}</span>
                        </span>
                        {isTopRecommendation(site.domain) && (
                          <span
                            data-testid={`recommendation-star-${site.domain}`}
                            className="inline-flex items-center gap-0.5 text-xs text-amber-600"
                          >
                            <StarIcon className="size-3 fill-amber-400" />
                            <span>Recommended</span>
                          </span>
                        )}
                      </div>
                      {site.reasoning && (
                        <span className="text-xs text-base-400">{site.reasoning}</span>
                      )}
                    </div>
                    {selectedDomain === site.domain && (
                      <CheckIcon className="size-4 text-primary-500" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Connect your own site link */}
          <div className="border-t border-neutral-200" />
          <div className="p-2">
            <button
              type="button"
              data-testid="connect-own-site-button"
              disabled={!canConnectCustomDomain}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-2 rounded text-sm text-left transition-colors",
                canConnectCustomDomain ? "hover:bg-neutral-100" : "opacity-60 cursor-not-allowed"
              )}
              onClick={() => {
                if (!canConnectCustomDomain) return;
                setIsOpen(false);
                onConnectOwnSite?.();
              }}
            >
              {canConnectCustomDomain ? (
                <LinkIcon className="size-4 text-base-400" />
              ) : (
                <LockClosedIcon className="size-4 text-base-400" />
              )}
              <span className="text-base-500 flex-1">Connect your own site</span>
              {canConnectCustomDomain && <ArrowRightIcon className="size-4 text-base-400" />}
            </button>
            {/* Show upgrade badge only for Starter plan users */}
            {!canConnectCustomDomain && (
              <div className="flex justify-center mt-1" data-testid="upgrade-badge">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-amber-400 to-orange-400 text-white">
                  <span>✨</span>
                  <span>Available on Growth & Pro Plan</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
