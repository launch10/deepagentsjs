import { useState, useMemo, useCallback } from "react";
import { ChevronDownIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import { StarIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { router } from "@inertiajs/react";
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

  // Get existing platform subdomains from Rails (source of truth)
  const existingPlatformSubdomains = useMemo(() => {
    if (!context?.existing_domains) return [];
    return context.existing_domains.filter((d) => d.is_platform_subdomain);
  }, [context]);

  // Set of existing domain names for quick lookup
  const existingDomainNames = useMemo(() => {
    if (!context?.existing_domains) return new Set<string>();
    return new Set(context.existing_domains.map((d) => d.domain));
  }, [context]);

  // AI-suggested sites, filtered to exclude domains that now exist in Rails
  const suggestedSites = useMemo(() => {
    if (!recommendations?.recommendations) return [];
    return recommendations.recommendations
      .filter((r) => r.source === "generated")
      .filter((r) => !existingDomainNames.has(r.domain)); // Filter out claimed domains
  }, [recommendations, existingDomainNames]);

  // Existing custom domains from context (Requirement 7: show in BOTH picker views)
  const existingCustomDomains = useMemo(() => {
    if (!context?.existing_domains) return [];
    return context.existing_domains.filter((d) => !d.is_platform_subdomain);
  }, [context]);

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
    // Show full URL (including suffix) in the trigger
    return selectedDomain;
  }, [selectedDomain]);

  // Handle selecting a domain from the dropdown
  const handleSelect = (
    domain: string,
    subdomain: string,
    source: "existing" | "generated",
    existingDomainId?: number
  ) => {
    console.log("[SiteNameDropdown] handleSelect called:", { domain, subdomain, source, existingDomainId });
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
            "rounded-lg border border-neutral-300 bg-white px-3 py-2.5",
            "text-sm text-left transition-colors",
            "hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          )}
        >
          <span className={cn("truncate", selectedDomain ? "text-base-600" : "text-base-400")}>
            {selectedDisplayName}
          </span>
          <ChevronDownIcon className="size-4 text-base-400 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="max-h-96 overflow-y-auto">
          {/* Create New Site Section */}
          <div className="px-4 py-3">
            <div className="text-sm font-medium text-base-400 mb-2">Create New Site</div>
            <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
              <Input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value.toLowerCase())}
                placeholder="Type to create your own"
                className="text-sm bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isOutOfCredits}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customValidation.valid) {
                    handleCustomSubmit();
                  }
                }}
              />
              <span className="pr-3 text-sm text-base-400 whitespace-nowrap">{PLATFORM_SUFFIX}</span>
            </div>
            {customInput && customValidation.error && (
              <p className="text-xs text-destructive mt-1">{customValidation.error}</p>
            )}
            {/* Upgrade link - shown right under the locked input when out of credits */}
            {isOutOfCredits && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.visit("/settings");
                }}
                className="flex items-center gap-2 mt-2 text-sm text-base-500 hover:text-base-600 transition-colors cursor-pointer"
              >
                <LockClosedIcon className="size-4" />
                <span>Upgrade to create more launch10 sites</span>
              </button>
            )}
          </div>

          {/* Existing Platform Subdomains Section (from Rails - source of truth) */}
          {existingPlatformSubdomains.length > 0 && (
            <>
              <div className="border-t border-neutral-100" />
              <div className="px-4 py-3">
                <div className="text-sm font-medium text-base-400 mb-2">Your Existing Sites</div>
                <div className="flex flex-col gap-0.5">
                  {existingPlatformSubdomains.map((domain) => {
                    const subdomain = domain.domain.replace(".launch10.site", "");
                    // Show the domain with its first URL path if any
                    const firstUrl = domain.website_urls[0];
                    const displayUrl = firstUrl?.path && firstUrl.path !== "/"
                      ? `${domain.domain}${firstUrl.path}`
                      : domain.domain;

                    return (
                      <button
                        key={domain.id}
                        type="button"
                        onClick={() => handleSelect(domain.domain, subdomain, "existing", domain.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left",
                          "transition-colors",
                          selectedDomain === domain.domain
                            ? "bg-neutral-100"
                            : "hover:bg-neutral-50"
                        )}
                      >
                        {/* Star icon on the left for recommended */}
                        {isTopRecommendation(domain.domain) ? (
                          <StarIcon className="size-5 text-base-400 shrink-0" />
                        ) : (
                          <span className="size-5 shrink-0" />
                        )}

                        {/* Full URL - no wrapping */}
                        <span className="flex-1 text-base-600 truncate">{displayUrl}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Suggested Sites Section */}
          {suggestedSites.length > 0 && (
            <>
              <div className="border-t border-neutral-100" />
              <div className="px-4 py-3">
                <div className="text-sm font-medium text-base-400 mb-2">
                  Create New Site (Suggestions)
                </div>
                <div className="flex flex-col gap-0.5">
                  {suggestedSites.map((site) => (
                    <button
                      key={site.domain}
                      type="button"
                      disabled={isOutOfCredits}
                      onClick={() => handleSelect(site.domain, site.subdomain, "generated")}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left",
                        "transition-colors",
                        selectedDomain === site.domain
                          ? "bg-neutral-100"
                          : "hover:bg-neutral-50",
                        isOutOfCredits && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {/* Star icon on the left for recommended */}
                      {isTopRecommendation(site.domain) ? (
                        <StarIcon className="size-5 text-base-400 shrink-0" />
                      ) : (
                        <span className="size-5 shrink-0" />
                      )}

                      {/* Full URL - no wrapping */}
                      <span className="flex-1 text-base-600 truncate">{site.fullUrl}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Existing Custom Domains Section (Requirement 7) */}
          {existingCustomDomains.length > 0 && (
            <>
              <div className="border-t border-neutral-100" />
              <div className="px-4 py-3">
                <div className="text-sm font-medium text-base-400 mb-2">Your Custom Domains</div>
                <div className="flex flex-col gap-0.5">
                  {existingCustomDomains.map((domain) => (
                    <button
                      key={domain.id}
                      type="button"
                      onClick={() => {
                        // Custom domains don't have a subdomain in the same sense
                        onSelect(domain.domain, domain.domain.split(".")[0], "existing", domain.id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left",
                        "transition-colors",
                        selectedDomain === domain.domain
                          ? "bg-neutral-100"
                          : "hover:bg-neutral-50"
                      )}
                    >
                      <span className="size-5 shrink-0" />
                      <span className="flex-1 text-base-600 truncate">{domain.domain}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Bottom section - Connect own site and upgrade options */}
          <div className="border-t border-neutral-100" />
          <div className="px-4 py-3 flex flex-col gap-2">
            {/* Connect your own site - shown for Growth/Pro users */}
            {canConnectCustomDomain ? (
              <button
                type="button"
                data-testid="connect-own-site-button"
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm border border-neutral-200 hover:bg-neutral-50 transition-colors"
                onClick={() => {
                  setIsOpen(false);
                  onConnectOwnSite?.();
                }}
              >
                <span className="text-base-600">Connect your own site</span>
                <ArrowRightIcon className="size-4 text-base-400" />
              </button>
            ) : (
              /* Starter users - show upgrade to launch more sites */
              <div className="w-full flex items-center gap-2 px-3 py-2 text-sm text-base-400">
                <LockClosedIcon className="size-4" />
                <span className="flex-1">Upgrade to launch more sites</span>
              </div>
            )}

            {/* Upgrade badge - shown for Starter users with purple-to-teal gradient */}
            {!canConnectCustomDomain && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.visit("/settings");
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm text-white border border-[#5867C4] transition-all hover:opacity-90 cursor-pointer"
                style={{ background: "linear-gradient(91deg, #5867C4 16.2%, #74BEA1 92.6%)" }}
                data-testid="upgrade-badge"
              >
                <img src="/images/icons/rocket.svg" alt="" className="size-4" />
                <span>Available on Growth & Pro Plan</span>
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
