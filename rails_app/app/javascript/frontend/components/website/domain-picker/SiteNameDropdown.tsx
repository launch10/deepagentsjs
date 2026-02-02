import { useState, useMemo, useCallback } from "react";
import { ChevronDownIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import {
  StarIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { router } from "@inertiajs/react";
import { cn } from "~/lib/utils";
import { validateSubdomain, validateDomain } from "~/lib/validation/domain";
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
    existingDomainId?: number,
    isPlatformSubdomain?: boolean
  ) => void;
}

const PLATFORM_SUFFIX = ".launch10.site";

// ============================================================================
// Component
// ============================================================================

export function SiteNameDropdown({
  recommendations,
  context,
  selectedDomain,
  isOutOfCredits,
  onSelect,
}: SiteNameDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [platformInput, setPlatformInput] = useState("");
  const [customDomainInput, setCustomDomainInput] = useState("");

  // All existing domains (both platform and custom) merged into one list
  const existingDomains = useMemo(() => {
    if (!context?.existing_domains) return [];
    return context.existing_domains;
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
    return selectedDomain;
  }, [selectedDomain]);

  // Handle selecting an existing domain from the dropdown
  const handleSelectExisting = (
    domain: string,
    subdomain: string,
    source: "existing" | "generated",
    existingDomainId?: number,
    isPlatformSubdomain?: boolean
  ) => {
    onSelect(domain, subdomain, source, existingDomainId, isPlatformSubdomain);
    setIsOpen(false);
  };

  // Handle new platform subdomain submission (e.g., "mysite" → "mysite.launch10.site")
  const handlePlatformSubmit = () => {
    const subdomain = platformInput.toLowerCase().trim();
    const validation = validateSubdomain(subdomain);
    if (!validation.valid) return;

    const domain = `${subdomain}${PLATFORM_SUFFIX}`;
    onSelect(domain, subdomain, "custom", undefined, true);
    setIsOpen(false);
    setPlatformInput("");
  };

  // Handle new custom domain submission (e.g., "mybusiness.com")
  const handleCustomDomainSubmit = () => {
    const domain = customDomainInput.toLowerCase().trim();
    const validation = validateDomain(domain);
    if (!validation.valid) return;

    onSelect(domain, domain.split(".")[0], "custom", undefined, false);
    setIsOpen(false);
    setCustomDomainInput("");
  };

  const platformValidation = validateSubdomain(platformInput.toLowerCase().trim());
  const customDomainValidation = validateDomain(customDomainInput.toLowerCase().trim());

  // Check if user can add custom domains (Growth or Pro plan)
  const canAddCustomDomain = context?.plan_tier === "growth" || context?.plan_tier === "pro";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="site-name-dropdown"
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
          {/* ============================================ */}
          {/* SECTION 1: Create New Site (platform)       */}
          {/* ============================================ */}
          <div className="px-4 py-3">
            <div className="text-sm font-medium text-base-400 mb-2">Create New Site</div>
            <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
              <Input
                type="text"
                value={platformInput}
                onChange={(e) => setPlatformInput(e.target.value.toLowerCase())}
                placeholder="Type to create your own"
                className="text-sm bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isOutOfCredits}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (platformValidation.valid) {
                      handlePlatformSubmit();
                    }
                  }
                }}
              />
              <span className="pr-3 text-sm text-base-400 whitespace-nowrap">{PLATFORM_SUFFIX}</span>
            </div>
            {platformInput && platformValidation.error && (
              <p className="text-xs text-destructive mt-1">{platformValidation.error}</p>
            )}
            {/* Upgrade link - shown when out of credits */}
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

          {/* ============================================ */}
          {/* SECTION 2: Your Existing Sites (ALL)        */}
          {/* Platform + Custom domains merged together   */}
          {/* ============================================ */}
          {existingDomains.length > 0 && (
            <>
              <div className="border-t border-neutral-100" />
              <div className="px-4 py-3">
                <div className="text-sm font-medium text-base-400 mb-2">Your Existing Sites</div>
                <div className="flex flex-col gap-0.5">
                  {existingDomains.map((domain) => {
                    const isPlatform = domain.is_platform_subdomain;
                    const subdomain = isPlatform
                      ? domain.domain.replace(".launch10.site", "")
                      : domain.domain.split(".")[0];

                    // Show the domain with its first URL path if any
                    const firstUrl = domain.website_urls[0];
                    const displayUrl = firstUrl?.path && firstUrl.path !== "/"
                      ? `${domain.domain}${firstUrl.path}`
                      : domain.domain;

                    return (
                      <button
                        key={domain.id}
                        type="button"
                        onClick={() => handleSelectExisting(
                          domain.domain,
                          subdomain,
                          "existing",
                          domain.id,
                          isPlatform
                        )}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left",
                          "transition-colors",
                          selectedDomain === domain.domain
                            ? "bg-neutral-100"
                            : "hover:bg-neutral-50"
                        )}
                      >
                        {/* Star icon for top recommendation */}
                        {isTopRecommendation(domain.domain) ? (
                          <StarIcon className="size-5 text-amber-500 shrink-0" />
                        ) : (
                          <span className="size-5 shrink-0" />
                        )}

                        {/* Domain name */}
                        <span className="flex-1 text-base-600 truncate">{displayUrl}</span>

                        {/* DNS status indicator for custom domains */}
                        {!isPlatform && (
                          domain.dns_verification_status === "verified" ? (
                            <CheckCircleIcon className="size-4 text-success-500 shrink-0" />
                          ) : (
                            <ClockIcon className="size-4 text-amber-500 shrink-0" />
                          )
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ============================================ */}
          {/* SECTION 3: Suggestions                      */}
          {/* ============================================ */}
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
                      onClick={() => handleSelectExisting(
                        site.domain,
                        site.subdomain,
                        "generated",
                        undefined,
                        true
                      )}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left",
                        "transition-colors",
                        selectedDomain === site.domain
                          ? "bg-neutral-100"
                          : "hover:bg-neutral-50",
                        isOutOfCredits && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {/* Star icon for top recommendation */}
                      {isTopRecommendation(site.domain) ? (
                        <StarIcon className="size-5 text-amber-500 shrink-0" />
                      ) : (
                        <span className="size-5 shrink-0" />
                      )}

                      {/* Full URL */}
                      <span className="flex-1 text-base-600 truncate">{site.fullUrl}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ============================================ */}
          {/* SECTION 4: Add Custom Domain                */}
          {/* ============================================ */}
          <div className="border-t border-neutral-100" />
          <div className="px-4 py-3">
            {canAddCustomDomain ? (
              <>
                <div className="text-sm font-medium text-base-400 mb-2">Add Custom Domain</div>
                <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
                  <Input
                    type="text"
                    value={customDomainInput}
                    onChange={(e) => setCustomDomainInput(e.target.value.toLowerCase())}
                    placeholder="mybusiness.com"
                    className="text-sm bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    data-testid="custom-domain-input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        if (customDomainValidation.valid) {
                          handleCustomDomainSubmit();
                        }
                      }
                    }}
                  />
                </div>
                {customDomainInput && customDomainValidation.error && (
                  <p className="text-xs text-destructive mt-1">{customDomainValidation.error}</p>
                )}
              </>
            ) : (
              /* Starter users - show upgrade prompt */
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-base-400">
                  <LockClosedIcon className="size-4" />
                  <span>Custom domains on Growth & Pro</span>
                </div>
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
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
