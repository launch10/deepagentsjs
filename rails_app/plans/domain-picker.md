# Domain Picker Feature - Complete Requirements

## Overview

The Domain Picker allows users to assign a URL (domain + path) to their website. Users can choose platform subdomains (*.launch10.site) or connect custom domains.

---

## Core Data Model

| Entity | Ownership | Notes |
|--------|-----------|-------|
| **Domain** | Account | Claimed subdomain or custom domain, reusable across websites |
| **WebsiteUrl** | Website | Unique combination of domain + path. 1 per website. |
| **Website** | Project | Has exactly 1 WebsiteUrl at a time |

**Key Constraint:** `WebsiteUrl(domain_id, path)` is unique. Multiple websites can use the same domain with different paths.

---

## AI Recommendation System (Langgraph)

### How Recommendations Are Generated

1. **Trigger**: After `buildContext` completes, `domainRecommendationsNode` runs in parallel with `websiteBuilder`
2. **Input**: Brainstorm context (idea, audience, solution) + existing domains from Rails
3. **Process**: AI agent with tools generates creative subdomains, checks availability, scores recommendations
4. **Output**: 3 ranked recommendations in frontend-ready format

### AI Constraints

| Constraint | Value |
|------------|-------|
| Max subdomain length | 30 characters |
| Characters allowed | Lowercase letters, numbers, hyphens |
| Forbidden terms | "landing", "page", "site", "app" (generic) |
| Path format | Single-level only (e.g., /promo not /marketing/promo) |
| Default path for new domains | / (root) |

### AI Scoring (0-100)

| Score | Meaning |
|-------|---------|
| 90-100 | Perfect match - strongly conveys value proposition |
| 70-89 | Good match - relevant and brandable |
| 50-69 | Decent match - could work |
| 0-49 | Poor match - doesn't fit |

### Availability Filtering

AI uses two tools to check availability:

1. **`search_domains`** → Checks subdomain availability globally
   - `available` = nobody owns it
   - `existing` = current account owns it
   - `unavailable` = another account owns it (filtered out)

2. **`search_paths`** → Checks path availability on existing domains

**Already-claimed subdomains ARE filtered out** by the AI - it only recommends `available` or `existing` domains.

### State Values

| State | Meaning |
|-------|---------|
| `no_existing_sites` | User has no domains, showing generated suggestions |
| `existing_recommended` | User has domains, AI recommends using one |
| `new_recommended` | AI recommends creating a new subdomain |
| `out_of_credits_no_match` | At credit limit, no existing domains match well |

### Idempotency

Recommendations are computed once per graph run. If `domainRecommendations` already exists in state, the node skips.

---

## Requirements

### 1. Initialization & Pre-population

| Priority | Condition | Behavior |
|----------|-----------|----------|
| 1 | Has assigned WebsiteUrl | Show that URL as selected in the appropriate picker |
| 2 | Has AI recommendations (no assignment) | Pre-select top AI recommendation |
| 3 | No assignment, no recommendations (edge case) | Show empty picker, hide "Your existing sites" lists |

**Auto-switch to Custom Domain view:** If assigned URL is on a custom domain (not *.launch10.site), auto-switch to Custom Domain picker.

### 2. Two Picker Modes

#### Launch10 Site Picker (Default)
- Dropdown-based selection (not tabs)
- Shows:
  - **Create New Site** - Text input for new subdomain
  - **Your Existing Sites** - All account domains (platform AND custom) with their paths
  - **Suggestions** - AI recommendations
  - **Connect your own site** - Link to switch to Custom Domain picker
- Path input field with availability checking
- Full URL preview

#### Custom Domain Picker
- Domain input field with validation
- DNS verification status (checking → pending → verified)
- CNAME instructions with provider guides
- "Switch back to Launch10" link
- Path input field
- Full URL preview

### 3. Existing Domains Display

**Requirement:** Custom domains should appear in Launch10 picker AND be marked as existing domains (same category as platform subdomains, not separated).

**Dropdown sections:**
1. Create New Site (input)
2. Your Existing Sites (all claimed domains - both platform AND custom)
3. Create New Site - Suggestions (AI recommendations)
4. Connect your own site (or upgrade prompt)

### 4. Selection Behavior

| Action | Result |
|--------|--------|
| Select NEW platform subdomain | Show ClaimSubdomainModal (uses credit) |
| Select EXISTING domain (platform or custom) | Assign directly (no modal, no credit) |
| Enter new custom domain | Create domain, start DNS verification |

**View switching:** Assigned domain remains selected when switching between Launch10 ↔ Custom views.

### 5. Credit System (Platform Subdomains Only)

| Plan | Credits |
|------|---------|
| Starter | 0 |
| Growth | 2 |
| Pro | 3 |

**Credit flow:**
- Claiming NEW platform subdomain uses 1 credit
- Assigning EXISTING domain uses 0 credits
- Custom domains don't count against limit

**Out of credits:**
- Show amber banner in Launch10 picker
- Disable "Create New Site" input
- Disable AI suggestion buttons
- Show "Upgrade to launch more sites" link
- ClaimSubdomainModal shows upgrade prompt instead of claim UI

### 6. Path Validation

**Format:** Single-level paths only (e.g., `/landing`, `/pricing`)
- Regex: `/^\/[a-z0-9-]*$/`
- Root `/` always valid
- Max 50 characters
- No nested paths (no `/marketing/campaign`)

**Availability states:**
| Status | Meaning |
|--------|---------|
| `available` | Path is free on this domain |
| `assigned` | Path is assigned to THIS website (current assignment) |
| `existing` | Path is used by ANOTHER website in this account |
| `unavailable` | Path is taken by another account |

### 7. Domain Assignment

**What happens when user confirms selection:**
1. If NEW subdomain: Decrement credit locally (optimistic)
2. Create/update WebsiteUrl pointing to selected domain + path
3. If website had different domain previously: Old WebsiteUrl is replaced
4. Cache updated optimistically (for back button navigation)
5. Server responds with updated credits and assignment

**Key behavior:** Domains are account-wide. Once claimed, any website in the account can use that subdomain with any path.

### 8. DNS Verification (Custom Domains)

| State | Behavior |
|-------|----------|
| Checking | Show spinner (minimum 3s display for UX) |
| Pending | Show CNAME instructions, poll every 10s |
| Verified | Show success, stop polling |

**On failure:** Keep polling indefinitely until configured correctly.

### 9. Back Button Navigation

**Requirement:** When user navigates back to domain picker after making an assignment, they should see the successfully assigned domain (optimistic update), not stale data.

**Implementation:** Cache updated immediately on successful assignment before navigation.

---

## Edge Cases

### E1: Empty State (No AI Recommendations)
- This is an error/edge case (AI should always provide recommendations)
- Show empty picker for manual creation
- Hide "Your existing sites" and suggestions sections

### E2: User at Credit Limit
- Can still select EXISTING domains (no credit needed)
- Cannot create NEW platform subdomains
- Show upgrade prompts in appropriate places

### E3: Custom Domain Assigned, User Opens Launch10 Picker
- Show the custom domain as the current selection in the dropdown
- Allow user to select a different domain to replace it

### E4: Platform Subdomain Assigned, User Opens Custom Domain Picker
- Show empty custom domain input (not the platform subdomain)
- Allow user to enter a new custom domain

### E5: Path Taken by Another Website in Same Account
- Show "existing" status
- Allow user to select a different path

### E6: Path Taken by Another Account
- Show "unavailable" status
- User must choose different path

---

## What's NOT a Requirement (Evolutionary Artifacts)

Based on code review, these appear to be implementation details, not requirements:

1. **300ms debounce on path checking** - Performance optimization, not a UX requirement
2. **Minimum 3s display for "checking" state** - UX polish, not core functionality
3. **Controlled vs uncontrolled mode support** - API flexibility, not user-facing
4. **AI recommendation filtering on frontend** - Defensive coding (AI handles this)

---

## Test Specification

### Existing Test Coverage (Already Implemented)

The current `e2e/domain-picker.spec.ts` has ~950 lines covering:
- Page loading & basic UI
- Launch10/Custom mode switching
- Navigation (Previous/Continue buttons)
- Subdomain limit (out-of-credits banner, disabled inputs)
- Path availability checking (available, existing, validation errors)
- Credit updates after claiming
- Custom domain auto-switch when custom domain assigned
- Pre-population of assigned domains

### Tests That Need to be Added/Fixed

Based on requirements analysis, here are the gaps:

#### 1. Initialization Priority Tests
```
TEST: "uses AI recommendation when no domain is assigned"
  - No domain assigned to website
  - AI recommendations available
  - → Dropdown should show top recommendation pre-selected

TEST: "shows empty picker when no AI recommendations (edge case)"
  - No domain assigned
  - No AI recommendations (mock/force this state)
  - → Picker shows empty, no "Your existing sites" section
```

#### 2. Existing Domain Display Tests (BROKEN - currently skipped)
```
TEST: "shows custom domains alongside platform domains in Launch10 picker"
  - User has custom domain (my-custom-site.com in snapshot)
  - In Launch10 picker mode (not custom domain view)
  - Click dropdown → should see custom domain in "Your Existing Sites" section
  - Custom domains should NOT be in separate category

TEST: "custom domains appear in both pickers"
  - In Launch10 view: custom domains in dropdown
  - In Custom view: can type new or see existing custom domains
```

#### 3. Selection Persistence Tests
```
TEST: "assigned domain remains selected when switching Launch10 ↔ Custom views"
  - Assign domain (e.g., mysite.launch10.site/landing)
  - Switch to Custom Domain view
  - → Selection should still show mysite.launch10.site in some form
  - Switch back to Launch10 view
  - → Dropdown should show mysite.launch10.site selected

TEST: "re-selecting existing domain does NOT trigger claim modal"
  - Already have mysite.launch10.site claimed
  - Select it from dropdown
  - → Should assign directly, NO modal, NO credit deduction
```

#### 4. Domain Assignment Flow Tests
```
TEST: "assigning new subdomain replaces old assignment"
  - Website has mysite.launch10.site/landing assigned
  - Select newsite.launch10.site (new subdomain)
  - Confirm in modal
  - → Website now has newsite.launch10.site
  - → mysite.launch10.site still exists but not assigned to this website

TEST: "can reassign same domain with different path"
  - Website has mysite.launch10.site/landing assigned
  - Keep mysite.launch10.site, change path to /promo
  - → Website now has mysite.launch10.site/promo
  - No credit used (same domain)
```

#### 5. Back Button / Optimistic Update Tests
```
TEST: "back button shows newly assigned domain, not stale data"
  - Start with no domain
  - Claim newsite.launch10.site
  - Navigate to deploy page
  - Click back to domain picker
  - → Should show newsite.launch10.site as assigned (not AI recommendations)

TEST: "credits update reflects immediately after claim"
  - Start with 2 credits
  - Claim a subdomain
  - Navigate away and back
  - → Credits should show 1 (not stale 2)
```

#### 6. Path Collision Tests
```
TEST: "shows 'existing' when path used by another website in account"
  - meeting-tool.launch10.site has /landing (assigned to different website)
  - Select meeting-tool.launch10.site
  - Type "landing" in path input
  - → Should show "existing" status (used by another website)

TEST: "shows 'assigned' when path used by current website"
  - Assign mysite.launch10.site/landing to this website
  - Navigate back to domain picker
  - Verify path shows "assigned" status

TEST: "root path / is always valid"
  - Select any domain
  - Clear path input (should default to /)
  - → Should show "available" or "assigned" (never error)
```

#### 7. DNS Verification Tests
```
TEST: "custom domain shows pending verification status"
  - Enter new custom domain (mybiz.example.com)
  - Submit/assign
  - → Should show "Pending" DNS status
  - → Should show CNAME instructions

TEST: "DNS verification polls until verified"
  - Custom domain assigned
  - DNS not configured
  - → Shows pending, continues polling
  - (Mock) DNS becomes verified
  - → Shows verified, stops polling
```

#### 8. Credit Edge Cases
```
TEST: "assigning EXISTING domain uses 0 credits"
  - Have scheduling-tool.launch10.site claimed
  - Have 1 credit remaining
  - Select scheduling-tool from dropdown
  - → Assigns directly (no modal)
  - → Still have 1 credit remaining

TEST: "upgrade prompt in modal when 0 credits"
  - Fill subdomain limit
  - Try to create new subdomain
  - Open claim modal
  - → Modal shows upgrade prompt, not claim button
```

#### 9. AI Recommendation Tests (E2E)
```
TEST: "AI recommendations respect subdomain constraints"
  - Recommendations should NOT contain generic terms (landing, page, site, app)
  - Subdomains should be <= 30 characters
  - Should be lowercase with hyphens only

TEST: "AI recommendations use brainstorm context"
  - Create brainstorm with specific idea (e.g., "Pet Portrait Service")
  - Generate recommendations
  - → Subdomains should relate to pets/portraits (e.g., paw-portraits)
  - → NOT generic random names

TEST: "AI filters unavailable domains from recommendations"
  - Force scenario where top suggestion is taken by another account
  - → Should NOT appear in recommendations
  - → Should show next-best available option

TEST: "AI provides different state based on existing domains"
  - User with good-fit existing domain → state: "existing_recommended"
  - User with no domains → state: "no_existing_sites" or "new_recommended"
  - User at credit limit with no good matches → state: "out_of_credits_no_match"

TEST: "recommendations are idempotent"
  - Generate recommendations
  - Navigate away and back
  - → Same recommendations (not regenerated)
  - → Quick load (cached)
```

#### 10. Credit System + AI Interaction Tests
```
TEST: "out of credits still shows generated suggestions (disabled)"
  - User at credit limit
  - AI still generates recommendations
  - → Suggestions visible but disabled/grayed out
  - → Existing domains still selectable

TEST: "AI search tools return correct availability status"
  - Mock Rails API responses for search_domains
  - → available: can claim
  - → existing: already owned by account
  - → unavailable: owned by another account (hidden from UI)
```

### API Tests to Add (RSpec)

```ruby
describe "POST /api/v1/domains/search" do
  it "returns available for unclaimed subdomains" do
    # subdomain not in database
    # → status: "available"
  end

  it "returns existing for account-owned subdomains" do
    # subdomain owned by current account
    # → status: "existing", existing_id: <id>
  end

  it "returns unavailable for other-account subdomains" do
    # subdomain owned by different account
    # → status: "unavailable", existing_id: nil
  end
end

describe "POST /api/v1/domains" do
  context "when assigning existing domain to new website" do
    it "does not decrement credits" do
      # existing domain owned by account
      # assign to different website
      # credits should stay same
    end

    it "unlinks old website_url when assigning new domain" do
      # website has domain A assigned
      # assign domain B
      # domain A's website_url should be removed (or website_id nulled)
    end
  end

  context "path uniqueness" do
    it "allows same domain with different paths on different websites" do
      # mysite.launch10.site/landing on website A
      # mysite.launch10.site/promo on website B
      # Both should succeed
    end

    it "rejects duplicate domain+path combo" do
      # mysite.launch10.site/landing already exists
      # try to create same combo
      # Should fail with validation error
    end
  end
end
```

### Langgraph Tests to Add (TypeScript/Vitest)

```typescript
describe("domainRecommendationsNode", () => {
  it("uses brainstorm context for domain generation", async () => {
    const state = {
      brainstorm: { idea: "Pet Portrait Service", audience: "Pet owners", solution: "Custom portraits" }
    };
    // Run node → recommendations should relate to pets/portraits
  });

  it("returns early if recommendations already exist (idempotent)", async () => {
    const state = { domainRecommendations: { /* existing */ } };
    // Run node → should return {} without calling API
  });

  it("filters unavailable domains from final recommendations", async () => {
    // Mock search_domains to return mix of available/unavailable
    // → Only available/existing should be in output
  });

  it("handles out-of-credits gracefully", async () => {
    const state = { domainContext: { platform_subdomain_credits: { remaining: 0 } } };
    // Run node → should still generate suggestions but mark state appropriately
  });

  it("scores existing domains based on business fit", async () => {
    // Provide existing domain that matches business perfectly
    // → Should score 90+ and be top recommendation
  });
});

describe("search_domains tool", () => {
  it("correctly maps Rails API response to tool output", () => {
    // Mock Rails response → verify tool returns correct format
  });
});

describe("search_paths tool", () => {
  it("checks path availability on existing domains", () => {
    // Domain has /landing taken
    // Search for /landing → should return "existing" or "unavailable"
  });
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `rails_app/e2e/domain-picker.spec.ts` | Add missing test cases, unskip broken tests |
| `rails_app/e2e/pages/domain-picker.page.ts` | Add helper methods if needed |
| `rails_app/e2e/fixtures/database.ts` | Add snapshot helpers for edge cases |
| `rails_app/spec/requests/api/v1/domains_spec.rb` | Add API-level tests for edge cases |
| `langgraph_app/app/nodes/website/recommendDomains.test.ts` | Add/update unit tests for AI node |
| `langgraph_app/app/tools/searchDomains.test.ts` | Add tests for domain search tool |
| `langgraph_app/app/tools/searchPaths.test.ts` | Add tests for path search tool |

---

## Implementation Order

### Phase 1: Fix Broken Tests
1. Unskip and fix "Existing Domains" e2e tests (currently skipped)
2. Ensure snapshot data includes necessary test fixtures

### Phase 2: Core Flow Tests
3. Add initialization priority tests (assigned → AI → empty)
4. Add selection persistence tests (view switching keeps selection)
5. Add assignment flow tests (replacing domains, path changes)
6. Add back button / optimistic update tests

### Phase 3: Edge Case Tests
7. Add path collision tests (existing, assigned, unavailable)
8. Add credit edge case tests (existing domain = 0 credits)
9. Add empty state edge case (no AI recommendations)

### Phase 4: API Tests (Rails)
10. Add domain search endpoint tests
11. Add domain assignment edge case tests
12. Add path uniqueness validation tests

### Phase 5: AI Tests (Langgraph)
13. Add recommendDomains node tests
14. Add search tool tests
15. Add idempotency and state tests

---

## Verification

### Full E2E Test Suite
```bash
cd rails_app
pnpm test:e2e -- --grep "Domain Picker"
```

### API Tests
```bash
cd rails_app
bundle exec rspec spec/requests/api/v1/domains_spec.rb
```

### Langgraph Tests
```bash
cd langgraph_app
pnpm test -- recommendDomains
pnpm test -- searchDomains
pnpm test -- searchPaths
```

### All Tests Pass
```bash
# All domain picker tests should pass - no manual verification needed
cd rails_app && pnpm test:e2e -- --grep "Domain Picker"
cd rails_app && bundle exec rspec spec/requests/api/v1/domains_spec.rb
cd ../langgraph_app && pnpm test -- recommendDomains
```

Every scenario in this document should have a corresponding automated test.

---

## Implementation Status (Updated 2026-02-01)

### Completed

1. **Created `bin/dev-test` script** - Was missing, required for e2e tests to run.

2. **Fixed `website_step.rb` snapshot builder**:
   - Removed deprecated `website:` parameter from Domain creation (column was removed from schema)
   - Reduced platform subdomains from 2 to 1 (Growth plan has 2-credit limit, leaving 1 credit for tests)
   - Fixed WebsiteUrl creation to respect 1:1 website-to-URL constraint
   - Enabled custom domain creation for testing custom domain scenarios

3. **Rebuilt `website_step` snapshot** with corrected schema (no `website_id` on domains table).

4. **Fixed test locator** in `domain-picker.spec.ts`:
   - Changed `text="Website Setup"` to `getByRole("heading", ...)` to avoid matching multiple elements

### Blocking Issues

1. **Database deadlock during snapshot restore**:
   - `PG::TRDeadlockDetected` errors when restoring snapshots between tests
   - Likely caused by Rails server holding connections while truncate/restore runs
   - Need to investigate connection pooling and transaction handling

2. **Test locators don't match actual UI**:
   - `"Your Existing Sites"` - Not found in current dropdown implementation
   - `"Create New Site"` / `"Suggestions"` - Not present in current UI
   - `"Continue"` button - Actually named `"Connect Site"`
   - Tests appear written for expected behavior, not actual implementation

3. **Dependent snapshots need rebuilding**:
   - All snapshots depending on `website_step` are now stale
   - Run `RAILS_ENV=test rake db:snapshot:build_all` to rebuild all

### Next Steps

1. **Fix deadlock issue** - Consider adding connection termination before snapshot restore in `Database::Snapshotter`

2. **Update test locators** - Align e2e tests with actual DomainPicker component UI elements

3. **Rebuild dependent snapshots** - Run full snapshot rebuild after fixing deadlock

4. **Run API tests** - `bundle exec rspec spec/requests/api/v1/domains_spec.rb` to verify backend behavior
