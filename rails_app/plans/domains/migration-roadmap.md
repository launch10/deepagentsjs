# Domain Picker - Complete Migration Roadmap

## Overview

This document provides a step-by-step checklist to migrate from the current implementation to the target design. Each phase can be completed and tested independently.

**Related Documents**:

- `domain-picker-spec.md` - Full requirements specification
- `gap-analysis.md` - Detailed comparison of current vs target state

---

## Phase 1: Database & Model Layer

**Goal**: Add DNS verification fields and update serialization

### Step 1.1: Add DNS Verification Fields

**Create migration**:

```bash
bin/rails g migration AddDnsVerificationToDomains \
  dns_verification_status:string \
  dns_last_checked_at:datetime \
  dns_error_message:string
```

**File**: `db/migrate/YYYYMMDDHHMMSS_add_dns_verification_to_domains.rb`

```ruby
class AddDnsVerificationToDomains < ActiveRecord::Migration[8.0]
  def change
    add_column :domains, :dns_verification_status, :string, default: nil
    add_column :domains, :dns_last_checked_at, :datetime
    add_column :domains, :dns_error_message, :string
    add_index :domains, :dns_verification_status
    add_index :domains, :dns_last_checked_at
  end
end
```

**Verification**:

- [ ] Run `bin/rails db:migrate`
- [ ] Verify columns exist: `Domain.column_names.include?('dns_verification_status')`
- [ ] Test: `Domain.new.dns_verification_status` returns `nil`

---

### Step 1.2: Update Domain Model

**File**: `app/models/domain.rb`

**Add**:

```ruby
VERIFICATION_STATUSES = %w[pending verified failed].freeze

validates :dns_verification_status, inclusion: { in: VERIFICATION_STATUSES }, allow_nil: true

scope :unverified_custom_domains, -> {
  where(is_platform_subdomain: false)
    .where.not(dns_verification_status: 'verified')
}

def requires_dns_verification?
  !is_platform_subdomain && dns_verification_status != 'verified'
end

def dns_verified?
  dns_verification_status == 'verified'
end
```

**Verification**:

- [ ] Test validation: `Domain.new(dns_verification_status: 'invalid').valid?` returns false
- [ ] Test scope: `Domain.unverified_custom_domains` returns expected results

---

### Step 1.3: Create DNS Verification Service

**File**: `app/services/domains/dns_verification_service.rb` (NEW)

```ruby
module Domains
  class DnsVerificationService
    EXPECTED_CNAME = "cname.launch10.ai".freeze

    def initialize(domain)
      @domain = domain
    end

    def verify
      return success_result if @domain.is_platform_subdomain

      begin
        actual_cname = lookup_cname(@domain.domain)

        if cname_matches?(actual_cname)
          update_domain('verified', actual_cname, nil)
          success_result(actual_cname)
        else
          update_domain('pending', actual_cname, "CNAME not configured")
          pending_result(actual_cname, "Expected #{EXPECTED_CNAME}, got #{actual_cname || 'nothing'}")
        end
      rescue Resolv::ResolvError => e
        update_domain('pending', nil, e.message)
        pending_result(nil, "DNS lookup failed: #{e.message}")
      rescue => e
        update_domain('failed', nil, e.message)
        failed_result(e.message)
      end
    end

    private

    def lookup_cname(domain)
      Resolv::DNS.open do |dns|
        # Try www subdomain first, then root
        begin
          resource = dns.getresource("www.#{domain}", Resolv::DNS::Resource::IN::CNAME)
          resource.name.to_s
        rescue Resolv::ResolvError
          # Try root domain
          resource = dns.getresource(domain, Resolv::DNS::Resource::IN::CNAME)
          resource.name.to_s
        end
      end
    rescue Resolv::ResolvError
      nil
    end

    def cname_matches?(actual)
      actual&.downcase&.chomp('.') == EXPECTED_CNAME
    end

    def update_domain(status, actual_cname, error_message)
      @domain.update!(
        dns_verification_status: status,
        dns_last_checked_at: Time.current,
        dns_error_message: error_message
      )
    end

    def success_result(actual_cname = nil)
      { status: 'verified', actual_cname: actual_cname, error: nil }
    end

    def pending_result(actual_cname, error)
      { status: 'pending', actual_cname: actual_cname, error: error }
    end

    def failed_result(error)
      { status: 'failed', actual_cname: nil, error: error }
    end
  end
end
```

**Verification**:

- [ ] Unit test with mock DNS responses
- [ ] Test platform subdomain returns 'verified' immediately
- [ ] Test correct CNAME returns 'verified'
- [ ] Test incorrect CNAME returns 'pending'
- [ ] Test DNS error doesn't crash service

---

### Step 1.4: Update Domain Serialization

**File**: `app/models/concerns/domain_concerns/serialization.rb`

**Add DNS fields to `to_api_json`**:

```ruby
def to_api_json(include_website_urls: false)
  json = {
    id: id,
    domain: domain,
    is_platform_subdomain: is_platform_subdomain,
    website_id: website_id,
    dns_verification_status: dns_verification_status,
    dns_last_checked_at: dns_last_checked_at&.iso8601,
    dns_error_message: dns_error_message,
    created_at: created_at.iso8601
  }

  if include_website_urls
    json[:website_urls] = website_urls.map(&:to_api_json)
  end

  json
end
```

**File**: `app/controllers/api/v1/context_controller.rb`

**Update `serialize_domain`**:

```ruby
def serialize_domain(domain)
  {
    id: domain.id,
    domain: domain.domain,
    is_platform_subdomain: domain.is_platform_subdomain,
    website_id: domain.website_id,
    website_name: domain.website&.name,
    website_urls: domain.website_urls.map { |url|
      {
        id: url.id,
        path: url.path,
        website_id: url.website_id,
        is_deployed: url.website&.last_successful_deploy.present?  # ADD
      }
    },
    dns_verification_status: domain.dns_verification_status,  # ADD
    created_at: domain.created_at.iso8601
  }
end
```

**Verification**:

- [ ] `GET /api/v1/websites/:id/domain_context` includes `dns_verification_status`
- [ ] Platform subdomains return `null` for dns_verification_status
- [ ] `is_deployed` flag present on website_urls

---

## Phase 2: API Endpoints

### Step 2.1: Add verify_dns Endpoint

**File**: `app/controllers/api/v1/domains_controller.rb`

**Add action**:

```ruby
def verify_dns
  domain = current_account.domains.find_by(id: params[:id])

  unless domain
    render json: { errors: ["Domain not found"] }, status: :not_found
    return
  end

  if domain.is_platform_subdomain
    render json: {
      domain_id: domain.id,
      domain: domain.domain,
      verification_status: 'verified',
      expected_cname: nil,
      actual_cname: nil,
      last_checked_at: nil,
      error_message: nil
    }
    return
  end

  result = Domains::DnsVerificationService.new(domain).verify

  render json: {
    domain_id: domain.id,
    domain: domain.domain,
    verification_status: result[:status],
    expected_cname: Domains::DnsVerificationService::EXPECTED_CNAME,
    actual_cname: result[:actual_cname],
    last_checked_at: domain.reload.dns_last_checked_at&.iso8601,
    error_message: result[:error]
  }
end
```

**File**: `config/routes/api.rb`

**Update routes**:

```ruby
resources :domains, only: [:index, :show, :create, :update] do
  collection do
    post :search
  end
  member do
    post :verify_dns  # ADD
  end
end
```

**Verification**:

- [ ] `POST /api/v1/domains/123/verify_dns` returns 200
- [ ] Returns 404 for non-existent domain
- [ ] Platform subdomains return 'verified' without lookup
- [ ] Response matches schema

---

## Phase 3: Frontend Types & Services

### Step 3.1: Update TypeScript Types

**File**: `shared/lib/api/types/` (create if needed)

```typescript
export type DnsVerificationStatus = "pending" | "verified" | "failed" | null;

export interface DomainWithWebsite {
  id: number;
  domain: string;
  is_platform_subdomain: boolean;
  website_id: number | null;
  website_name: string | null;
  website_urls: WebsiteUrlWithDeployStatus[];
  dns_verification_status: DnsVerificationStatus;
  created_at: string;
}

export interface WebsiteUrlWithDeployStatus {
  id: number;
  path: string;
  website_id: number;
  is_deployed: boolean; // NEW
}

export interface VerifyDnsResponse {
  domain_id: number;
  domain: string;
  verification_status: DnsVerificationStatus;
  expected_cname: string | null;
  actual_cname: string | null;
  last_checked_at: string | null;
  error_message: string | null;
}
```

**Verification**:

- [ ] Types compile without errors
- [ ] No type errors in existing components

---

### Step 3.2: Update DomainsAPIService

**File**: `shared/lib/api/services/domainsAPIService.ts`

**Add method**:

```typescript
async verifyDns(domainId: number): Promise<VerifyDnsResponse> {
  const response = await this.fetch(`/api/v1/domains/${domainId}/verify_dns`, {
    method: 'POST',
  });
  return response.json();
}
```

**Verification**:

- [ ] `domainsAPIService.verifyDns(123)` makes correct API call

---

### Step 3.3: Create useDnsVerification Hook

**File**: `app/javascript/frontend/hooks/useDnsVerification.ts` (NEW)

```typescript
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDomainsService } from "~/api/domains.hooks";
import type { VerifyDnsResponse } from "@shared";

interface UseDnsVerificationOptions {
  enabled?: boolean;
  pollInterval?: number;
}

export function useDnsVerification(
  domainId: number | null,
  options: UseDnsVerificationOptions = {}
) {
  const { enabled = true, pollInterval = 30000 } = options;
  const domainsService = useDomainsService();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["dns-verification", domainId],
    queryFn: () => domainsService.verifyDns(domainId!),
    enabled: enabled && domainId !== null,
    refetchInterval: (data) => {
      // Stop polling once verified
      if (data?.verification_status === "verified") return false;
      return pollInterval;
    },
    staleTime: 10000,
  });

  const manualCheck = async () => {
    if (!domainId) return null;
    return queryClient.invalidateQueries({ queryKey: ["dns-verification", domainId] });
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isVerified: query.data?.verification_status === "verified",
    isPending: query.data?.verification_status === "pending",
    isFailed: query.data?.verification_status === "failed",
    error: query.data?.error_message,
    manualCheck,
  };
}
```

**Verification**:

- [ ] Hook polls every 30s when status is pending
- [ ] Hook stops polling when status is verified
- [ ] `manualCheck()` triggers immediate refetch

---

## Phase 4: UI Structure Refactor

### Step 4.0: Remove Tab-Based Architecture (MAJOR)

**Goal**: Replace tab switcher with dropdown-first design

**File**: `app/javascript/frontend/components/website/domain-picker/DomainPicker.tsx`

**Remove**:

- Import: `import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";`
- State: `const [mode, setMode] = useState<PickerMode>("launch10");`
- The entire `<Tabs>` JSX structure

**Replace with**:

```tsx
export function DomainPicker({ onComplete, onBack }: DomainPickerProps) {
  const [showCustomDomain, setShowCustomDomain] = useState(false);
  // ... existing context hooks ...

  if (showCustomDomain) {
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
        <CustomDomainPicker
          selection={selection}
          onSelect={handleSelect}
          onSwitchToLaunch10={() => setShowCustomDomain(false)}
        />
        {/* Full URL Preview */}
        {selection && (
          <div className="pt-4 border-t border-neutral-200">
            <FullUrlPreview ... />
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
        <p className="text-xs leading-4 text-base-300">Choose how you want your website to be accessed</p>
      </div>

      {/* Launch10 picker - no tabs */}
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
          <FullUrlPreview ... />
        </div>
      )}
    </div>
  );
}
```

**Verification**:

- [ ] No tab switcher visible
- [ ] "Connect your own site" in dropdown triggers custom domain view
- [ ] "Use a Launch10 Site" in custom domain returns to main view

---

### Step 4.0b: Remove "Free & Instant" Banner

**File**: `app/javascript/frontend/components/website/domain-picker/Launch10SitePicker.tsx`

**Remove lines 107-118**:

```tsx
{
  /* DELETE THIS ENTIRE BLOCK */
}
<Item variant="outline" className="max-w-xl border-primary-300 bg-primary-100">
  <ItemMedia className="my-auto">
    <BoltIcon className="size-4 fill-primary-500" />
  </ItemMedia>
  <ItemContent>
    <ItemTitle>Free & Instant</ItemTitle>
    <ItemDescription className="text-base-600">
      Get started immediately with a free Launch10 subdomain. Perfect for testing and launching
      quickly.
    </ItemDescription>
  </ItemContent>
</Item>;
```

**Verification**:

- [ ] Banner no longer appears

---

### Step 4.0c: Add Info Icons to Labels

**File**: `app/javascript/frontend/components/website/domain-picker/Launch10SitePicker.tsx`

**Update labels to include tooltips**:

```tsx
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip";

// Site name label
<Label className="text-sm font-semibold leading-[18px] text-base-500 flex items-center gap-1">
  Your site name
  <Tooltip>
    <TooltipTrigger>
      <InformationCircleIcon className="size-4 text-base-400" />
    </TooltipTrigger>
    <TooltipContent>
      This is where your landing page will live (e.g., mysite.launch10.site)
    </TooltipContent>
  </Tooltip>
</Label>

// Page name label
<Label className="text-sm font-semibold leading-[18px] text-base-500 flex items-center gap-1">
  Page Name
  <Tooltip>
    <TooltipTrigger>
      <InformationCircleIcon className="size-4 text-base-400" />
    </TooltipTrigger>
    <TooltipContent>
      Optional - helps you group several pages within a single site. Example: /services or /pricing
    </TooltipContent>
  </Tooltip>
</Label>
```

**Verification**:

- [ ] Info icons visible next to both labels
- [ ] Hovering shows tooltip text

---

### Step 4.1: Move Out-of-Credits Banner to Top

**File**: `app/javascript/frontend/components/website/domain-picker/Launch10SitePicker.tsx`

**Current location**: Lines 149-165 (at bottom)
**Target location**: After "Free & Instant" info banner, before inputs

**Move the JSX block**:

```tsx
return (
  <div className="flex flex-col gap-5">
    {/* Info Banner - keep at top */}
    <Item variant="outline" className="max-w-xl border-primary-300 bg-primary-100">
      ...
    </Item>
    {/* Out of Credits Warning - MOVE HERE */}
    {isOutOfCredits && (
      <div
        data-testid="out-of-credits-banner"
        className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3"
      >
        <ExclamationCircleIcon className="size-5 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800 flex-1">
          You've hit the limit of {context?.platform_subdomain_credits?.limit} subdomains allowed on
          your current subscription plan.{" "}
          <a
            href="/subscriptions"
            className="font-medium text-amber-700 hover:text-amber-800 underline"
          >
            Upgrade to add more.
          </a>
        </p>
      </div>
    )}
    {/* Domain + Path Selection Row */}
    ...
  </div>
);
```

**Verification**:

- [ ] Banner appears above inputs when out of credits
- [ ] Matches design styling (amber/yellow background)

---

### Step 4.2: Fix Suffix Display Timing

**File**: `app/javascript/frontend/components/website/domain-picker/SiteNameDropdown.tsx`

**Current (always shows suffix)**:

```tsx
<span className="text-base-400">{PLATFORM_SUFFIX}</span>
```

**Target**: Only show suffix when input has value or is focused

**In trigger button** (lines 127-134):

```tsx
<span className="flex items-center gap-2">
  <span className={selectedDomain ? "text-base-600" : "text-base-400"}>{selectedDisplayName}</span>
  {/* Only show suffix if a domain is selected */}
  {selectedDomain && <span className="text-base-400">{PLATFORM_SUFFIX}</span>}
</span>
```

**In "Create New Site" input section** (lines 140-158):

```tsx
<div className="relative">
  <Input
    type="text"
    value={customInput}
    onChange={(e) => setCustomInput(e.target.value.toLowerCase())}
    placeholder="Type to create your own"
    className="text-sm pr-24" // Add padding for suffix
    disabled={isOutOfCredits}
    onKeyDown={(e) => {
      if (e.key === "Enter" && customValidation.valid) {
        handleCustomSubmit();
      }
    }}
  />
  {/* Show suffix only when input has value */}
  {customInput && (
    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-base-400">
      {PLATFORM_SUFFIX}
    </span>
  )}
</div>
```

**Verification**:

- [ ] Closed dropdown doesn't show suffix until domain selected
- [ ] Input shows suffix only after user starts typing

---

### Step 4.3: Lock Custom Domain for Starter Plan

**File**: `app/javascript/frontend/components/website/domain-picker/SiteNameDropdown.tsx`

**Update "Connect your own site" section** (lines 267-290):

```tsx
{/* Connect your own site link */}
<div className="border-t border-neutral-200" />
<div className="p-2">
  <button
    type="button"
    data-testid="connect-own-site-button"
    disabled={!canConnectCustomDomain}
    className={cn(
      "w-full flex items-center gap-2 px-2 py-2 rounded text-sm text-left transition-colors",
      canConnectCustomDomain
        ? "hover:bg-neutral-100"
        : "opacity-60 cursor-not-allowed"
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
    <span className="text-base-500">Connect your own site</span>
    <ArrowRightIcon className="size-4 text-base-400 ml-auto" />
  </button>
  {/* Show upgrade badge only for Starter plan users */}
  {!canConnectCustomDomain && (
    <div className="flex justify-center mt-1" data-testid="upgrade-badge">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-amber-400 to-orange-400 text-white">
        Available on Growth & Pro Plan
      </span>
    </div>
  )}
</div>
```

**Add imports**:

```tsx
import { LockClosedIcon, ArrowRightIcon } from "@heroicons/react/24/solid";
```

**Verification**:

- [ ] Starter plan shows lock icon
- [ ] Starter plan button is disabled
- [ ] Growth/Pro plan shows arrow icon and is clickable

---

### Step 4.4: Add Full URL Availability Indicator

**File**: `app/javascript/frontend/components/website/domain-picker/Launch10SitePicker.tsx`

**Add state and effect for availability checking**:

```tsx
const [availabilityStatus, setAvailabilityStatus] = useState<
  "checking" | "available" | "unavailable" | "deployed" | null
>(null);

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
    if (existingUrl?.is_deployed) {
      setAvailabilityStatus("deployed");
      return;
    }
  }

  // For new domains/paths, mark as available (already verified by AI or search)
  setAvailabilityStatus("available");
}, [selection, context]);
```

**Add UI below inputs**:

```tsx
{
  /* Availability Status */
}
{
  selection && availabilityStatus && (
    <div className="mt-2">
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
  );
}
```

**Verification**:

- [ ] Green "Available" message shows for valid selections
- [ ] Red "unavailable" message shows for taken subdomains
- [ ] Red "deployed" message shows for URLs that are live

---

## Phase 5: DNS Verification UI

### Step 5.1: Add DNS Status to CustomDomainPicker

**File**: `app/javascript/frontend/components/website/domain-picker/CustomDomainPicker.tsx`

**Add imports and state**:

```tsx
import { useDnsVerification } from "~/hooks/useDnsVerification";
import { ClockIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

// Inside component:
const [savedDomainId, setSavedDomainId] = useState<number | null>(null);
const { data: dnsStatus, isPending, isVerified, manualCheck } = useDnsVerification(savedDomainId);
```

**Add DNS status indicator after domain input**:

```tsx
{
  savedDomainId && (
    <div className="mt-3">
      {isVerified ? (
        <div className="flex items-center gap-2 text-success-500">
          <CheckCircleIcon className="size-5" />
          <span className="text-sm font-medium">DNS verified! Your domain is ready.</span>
        </div>
      ) : isPending ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-500">
            <ClockIcon className="size-5 animate-pulse" />
            <span className="text-sm">Waiting for DNS propagation...</span>
          </div>
          <button
            type="button"
            onClick={manualCheck}
            className="text-xs text-primary-500 hover:text-primary-600"
          >
            Check now
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-destructive">
          <XCircleIcon className="size-5" />
          <span className="text-sm">DNS verification failed: {dnsStatus?.error_message}</span>
        </div>
      )}
    </div>
  );
}
```

**Add domain creation handler** (when user enters a custom domain):

```tsx
const handleSaveDomain = async () => {
  if (!domainValidation.valid) return;

  try {
    const result = await createDomain({
      domain: domain,
      is_platform_subdomain: false,
    });
    setSavedDomainId(result.id);
  } catch (error) {
    console.error("Failed to create domain:", error);
  }
};
```

**Verification**:

- [ ] Entering domain triggers creation and verification
- [ ] Pending status shows with pulse animation
- [ ] "Check now" button triggers immediate check
- [ ] Verified status shows green checkmark
- [ ] Failed status shows error message

---

## Phase 6: E2E Testing

### Step 6.1: Add Comprehensive E2E Tests

**File**: `e2e/domain-picker.spec.ts` (update existing)

**Add new test cases**:

```typescript
test.describe("Domain Picker - Availability Checking", () => {
  test("shows available status for valid selection", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();
    await page.waitForTimeout(3000); // Wait for recommendations

    // Select a domain
    await domainPickerPage.selectTopRecommendation();

    // Should show "Available:" message
    await expect(page.locator("text=/Available:/")).toBeVisible();
  });

  test("shows deployed error when selecting live URL", async ({ page }) => {
    // Need a snapshot with a deployed website_url
    // ...
  });
});

test.describe("Domain Picker - Out of Credits", () => {
  test("shows warning banner at top when out of credits", async ({ page }) => {
    // Use snapshot where user has used all subdomain credits
    // ...
  });

  test("disables 'Create New Site' input when out of credits", async ({ page }) => {
    // ...
  });
});

test.describe("Domain Picker - Plan Gating", () => {
  test("locks custom domain option for Starter plan", async ({ page }) => {
    // Use snapshot with Starter plan user
    // ...
  });

  test("allows custom domain option for Growth plan", async ({ page }) => {
    // Use snapshot with Growth plan user
    // ...
  });
});

test.describe("Domain Picker - DNS Verification", () => {
  test("shows pending status for new custom domain", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Switch to custom domain
    await domainPickerPage.selectCustomDomainTab();

    // Enter a domain
    await page.fill('[data-testid="custom-domain-input"]', "test-domain.com");

    // Trigger save (blur or button)
    await page.keyboard.press("Tab");

    // Should show pending status
    await expect(page.locator("text=/Waiting for DNS/")).toBeVisible({ timeout: 10000 });
  });

  test("Check now button triggers immediate verification", async ({ page }) => {
    // ...
  });
});
```

**Verification**:

- [ ] All new E2E tests pass
- [ ] Existing tests still pass

---

## Checklist Summary

### Phase 1: Database & Model

- [ ] Run migration for DNS fields
- [ ] Add validations to Domain model
- [ ] Create DnsVerificationService
- [ ] Update domain serialization (to_api_json)
- [ ] Update context controller serialization

### Phase 2: API

- [ ] Add verify_dns endpoint
- [ ] Add route
- [ ] Write request specs

### Phase 3: Frontend Types

- [ ] Add DnsVerificationStatus type
- [ ] Update DomainWithWebsite interface
- [ ] Add is_deployed to WebsiteUrl
- [ ] Add VerifyDnsResponse type
- [ ] Add verifyDns to DomainsAPIService
- [ ] Create useDnsVerification hook

### Phase 4: UI Structure Refactor

- [ ] Remove tab-based architecture (major refactor)
- [ ] Remove "Free & Instant" banner
- [ ] Add info icons with tooltips to labels
- [ ] Move out-of-credits banner to top
- [ ] Fix suffix display timing
- [ ] Add lock icon for Starter plan
- [ ] Disable custom domain for Starter
- [ ] Add full URL availability indicator
- [ ] Add "site deployed" error state

### Phase 5: DNS Verification UI

- [ ] Add DnsStatusIndicator component
- [ ] Integrate into CustomDomainPicker
- [ ] Add manual check button
- [ ] Add auto-polling

### Phase 6: Testing

- [ ] Unit tests for DnsVerificationService
- [ ] Request specs for verify_dns
- [ ] E2E tests for availability
- [ ] E2E tests for out of credits
- [ ] E2E tests for plan gating
- [ ] E2E tests for DNS verification
