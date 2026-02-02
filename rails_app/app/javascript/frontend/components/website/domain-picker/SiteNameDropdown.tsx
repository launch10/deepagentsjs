import { useState, useMemo } from "react";
import { ChevronDownIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import {
  StarIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import { router } from "@inertiajs/react";
import { cn } from "~/lib/utils";
import { validateSubdomain, validateDomain } from "~/lib/validation/domain";
import { PLATFORM_SUFFIX } from "~/lib/domain";
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover";
import { Input } from "@components/ui/input";
import type { Website } from "@shared";
import type { GetDomainContextResponse } from "@rails_api_base";
import type { DomainOrigin } from "./DomainPicker";

// ============================================================================
// Types
// ============================================================================

export interface SiteNameDropdownProps {
  recommendations?: Website.DomainRecommendations.DomainRecommendations | null;
  context?: GetDomainContextResponse | null;
  selectedDomain: string | null;
  isOutOfCredits: boolean;
  onSelect: (domain: string, origin: DomainOrigin, existingDomainId?: number) => void;
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
}: SiteNameDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  // Toggle between platform (.launch10.site suffix) and custom (full domain) mode
  const [inputMode, setInputMode] = useState<"platform" | "custom">("platform");

  const existingDomains = context?.existing_domains ?? [];
  const existingDomainNames = new Set(existingDomains.map((d) => d.domain));

  // AI-suggested sites, filtered to exclude domains that now exist in Rails
  const suggestedSites = useMemo(() => {
    if (!recommendations?.recommendations) return [];
    return recommendations.recommendations
      .filter((r) => r.source === "suggestion")
      .filter((r) => !existingDomainNames.has(r.domain));
  }, [recommendations, existingDomainNames]);

  const isTopRecommendation = (domain: string) =>
    recommendations?.topRecommendation?.domain === domain;

  // Handle selecting a domain from the dropdown
  const handleSelect = (domain: string, origin: DomainOrigin, existingDomainId?: number) => {
    onSelect(domain, origin, existingDomainId);
    setIsOpen(false);
  };

  // Validation based on current mode
  const inputValidation =
    inputMode === "platform"
      ? validateSubdomain(inputValue.toLowerCase().trim())
      : validateDomain(inputValue.toLowerCase().trim());

  // Handle input submission (works for both platform and custom)
  const handleInputSubmit = () => {
    const value = inputValue.toLowerCase().trim();
    if (!inputValidation.valid) return;

    const domain = inputMode === "platform" ? `${value}${PLATFORM_SUFFIX}` : value;
    handleSelect(domain, "user-input");
    setInputValue("");
  };

  // Check if user can add custom domains (Growth or Pro plan)
  const canAddCustomDomain = context?.plan_tier === "growth" || context?.plan_tier === "pro";

  // Reset input mode and value when dropdown closes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setInputMode("platform");
      setInputValue("");
    }
  };

  // Determine if input should be disabled
  const isInputDisabled = inputMode === "platform" && isOutOfCredits;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
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
            {selectedDomain ?? "Select a domain..."}
          </span>
          <ChevronDownIcon className="size-4 text-base-400 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="max-h-96 overflow-y-auto">
          {/* ============================================ */}
          {/* SECTION 1: Create New Site Input            */}
          {/* Toggles between platform and custom mode    */}
          {/* ============================================ */}
          <div className="px-4 py-3">
            {/* Mode toggle header */}
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-base-400">
                {inputMode === "platform" ? "Create New Site" : "Connect Your Own Domain"}
              </div>
              {inputMode === "custom" && (
                <button
                  type="button"
                  onClick={() => {
                    setInputMode("platform");
                    setInputValue("");
                  }}
                  className="flex items-center gap-1 text-xs text-base-400 hover:text-base-500 transition-colors cursor-pointer"
                >
                  <ArrowLeftIcon className="size-3" />
                  <span>Back</span>
                </button>
              )}
            </div>

            {/* Input field - suffix shown only in platform mode */}
            <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
              <Input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.toLowerCase())}
                placeholder={
                  inputMode === "platform" ? "Type to create your own" : "mybusiness.com"
                }
                className="text-sm bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isInputDisabled}
                data-testid={
                  inputMode === "platform" ? "platform-domain-input" : "custom-domain-input"
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (inputValidation.valid) {
                      handleInputSubmit();
                    }
                  }
                }}
              />
              {/* Show suffix only in platform mode */}
              {inputMode === "platform" && (
                <span className="pr-3 text-sm text-base-400 whitespace-nowrap">
                  {PLATFORM_SUFFIX}
                </span>
              )}
            </div>

            {/* Validation error */}
            {inputValue && inputValidation.error && (
              <p className="text-xs text-destructive mt-1">{inputValidation.error}</p>
            )}

            {/* Upgrade link - shown when out of credits in platform mode */}
            {inputMode === "platform" && isOutOfCredits && (
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
                  {existingDomains.map((domainItem) => {
                    const isPlatform = domainItem.is_platform_subdomain;

                    // Show the domain with its first URL path if any
                    const firstUrl = domainItem.website_urls[0];
                    const displayUrl =
                      firstUrl?.path && firstUrl.path !== "/"
                        ? `${domainItem.domain}${firstUrl.path}`
                        : domainItem.domain;

                    return (
                      <button
                        key={domainItem.id}
                        type="button"
                        onClick={() => handleSelect(domainItem.domain, "existing", domainItem.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left",
                          "transition-colors",
                          selectedDomain === domainItem.domain
                            ? "bg-neutral-100"
                            : "hover:bg-neutral-50"
                        )}
                      >
                        {/* Star icon for top recommendation */}
                        {isTopRecommendation(domainItem.domain) ? (
                          <StarIcon className="size-5 text-amber-500 shrink-0" />
                        ) : (
                          <span className="size-5 shrink-0" />
                        )}

                        {/* Domain name */}
                        <span className="flex-1 text-base-600 truncate">{displayUrl}</span>

                        {/* DNS status indicator for custom domains */}
                        {!isPlatform &&
                          (domainItem.dns_verification_status === "verified" ? (
                            <CheckCircleIcon className="size-4 text-success-500 shrink-0" />
                          ) : (
                            <ClockIcon className="size-4 text-amber-500 shrink-0" />
                          ))}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ============================================ */}
          {/* SECTION 3: Suggestions                      */}
          {/* Only show in platform mode                  */}
          {/* ============================================ */}
          {inputMode === "platform" && suggestedSites.length > 0 && (
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
                      onClick={() => handleSelect(site.domain, "suggestion")}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left",
                        "transition-colors",
                        selectedDomain === site.domain ? "bg-neutral-100" : "hover:bg-neutral-50",
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
          {/* SECTION 4: Connect your own site button     */}
          {/* Only show in platform mode                  */}
          {/* ============================================ */}
          {inputMode === "platform" && (
            <>
              <div className="border-t border-neutral-100" />
              <div className="px-4 py-3">
                {canAddCustomDomain ? (
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("custom");
                      setInputValue("");
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm text-base-500 border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 transition-colors cursor-pointer"
                    data-testid="connect-own-site-button"
                  >
                    <span>Connect your own site</span>
                    <ArrowRightIcon className="size-4" />
                  </button>
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
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
