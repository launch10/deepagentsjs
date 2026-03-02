# Domain Picker - Gap Analysis

## Summary

This document compares the **current implementation** against the **target design** (from Figma screenshots). While the foundation exists, there are significant gaps in both UI/UX and functionality.

---

## Gap Categories

### Legend

- **GAP** - Feature missing or significantly different
- **PARTIAL** - Feature exists but incomplete
- **OK** - Feature matches design

---

## 1. UI Structure Gaps

### 1.1 Tab-Based vs Dropdown-First Design (MAJOR REFACTOR)

**Status**: GAP - ARCHITECTURAL CHANGE

**Current**:

- Tab switcher at top: "Launch10 Site" | "Custom Domain"
- Tabs control which picker component is shown
- Custom domain is a separate view/flow

**Design**:

- NO tabs at all
- Single unified dropdown
- "Connect your own site" is an OPTION inside the dropdown (at bottom)
- Clicking it switches to custom domain input inline or in a modal

**Impact**: This requires restructuring `DomainPicker.tsx` to remove the `<Tabs>` component entirely and making `SiteNameDropdown.tsx` the primary interface with custom domain access integrated.

**Files to modify**:

- `DomainPicker.tsx` - Remove `<Tabs>`, render Launch10SitePicker directly
- `SiteNameDropdown.tsx` - "Connect your own site" click should trigger custom domain mode
- `Launch10SitePicker.tsx` - May need to handle custom domain state
- `CustomDomainPicker.tsx` - May become a sub-view or modal instead of tab content

**Screenshot reference**: Side-by-side shows tabs on left (current), no tabs on right (design)

---

### 1.2 Dropdown Section Order (SIGNIFICANT DIFFERENCE)

**Status**: GAP

**Current order**:

1. "Create New Site" - input field
2. "Your Existing Sites" - if any exist
3. "Create New Site (Suggestions)" - AI suggestions
4. "Connect your own site" - link to custom domain

**Design order** (from screenshot):

1. "Create New Site" - input field at TOP
2. "Your Existing Sites" - with star on recommended one
3. "Create New Site (Suggestions)" - below existing
4. "Connect your own site" - at bottom with lock + upgrade badge

**Key difference**: The current code structure SEEMS correct but:

- Current shows "SUGGESTIONS" as the header (all caps) vs "Create New Site (Suggestions)"
- Current puts "+ Create your own" at BOTTOM as a link, design has INPUT at TOP
- Current mixes AI suggestions without clear separation from existing sites

**Files to modify**:

- `SiteNameDropdown.tsx` - Reorder sections, fix headers

---

### 1.3 Info Icons & Tooltips

**Status**: GAP

**Current**: Labels are plain text: "Your site name", "Page name"

**Design**: Labels have info icons (ℹ️) that likely show tooltips:

- "Your site name ℹ️"
- "Page Name ℹ️"

The tooltip content (from earlier screenshot) explains:

- "This is optional and can help you group several pages within a single site. Example: /services or /pricing"

**Files to modify**:

- `Launch10SitePicker.tsx` - Add info icons to labels
- Add `<Tooltip>` components with explanatory text

---

### 1.4 "Free & Instant" Banner - REMOVE

**Status**: GAP - REMOVE ENTIRELY

**Current**: Always shows "Free & Instant" info banner at top

**Design**: Banner is not in the design

**Action**: Remove the banner entirely from `Launch10SitePicker.tsx`

**Files to modify**:

- `Launch10SitePicker.tsx` - Remove lines 107-118 (the `<Item>` banner)

---

### 1.5 Suffix Display Timing

**Status**: GAP

**Current**: Always shows `.launch10.site` suffix in trigger button

```tsx
<span className="text-base-400">{PLATFORM_SUFFIX}</span>
```

**Design**: Suffix should ONLY appear after user focuses on the "Create New Site" input, NOT in the closed dropdown trigger.

**Files to modify**:

- `SiteNameDropdown.tsx` - Conditional suffix display

**Screenshot reference**: Interaction note "Also '.launch10.com' should only appear at the end of the input after a user selects into it"

---

### 1.3 Out of Credits Banner Position

**Status**: GAP

**Current**: Banner appears BELOW the domain/path inputs (in `Launch10SitePicker.tsx:149`)

**Design**: Banner should appear at the TOP of the picker, above inputs

- Yellow/amber background
- Text: "You've hit the limit of X subdomains allowed on your current subscription plan. Upgrade to add more."

**Files to modify**:

- `Launch10SitePicker.tsx` - Move banner to top
- Match design styling (yellow background with link)

**Screenshot reference**: Screenshot showing warning banner at top

---

### 1.4 Custom Domain Plan Gating

**Status**: PARTIAL

**Current**: Shows "Available on Growth & Pro Plan" badge but does NOT prevent access

**Design**:

- Starter users should see "Connect your own site" with LOCK icon
- Badge shown below the locked link
- Should NOT be able to click through to custom domain input

**Files to modify**:

- `SiteNameDropdown.tsx` - Add lock icon, disable click for Starter
- `CustomDomainPicker.tsx` - Add plan check guard

**Screenshot reference**: Screenshot showing locked link with badge

---

### 1.5 Availability Status Display

**Status**: GAP

**Current**:

- `PageNameInput` shows "/{path}" validation checkmark
- No full URL availability display

**Design**: Shows full availability status:

- Red: "Selected website is currently unavailable"
- Green: "Available: myphotos.launch10.com/pets"

**Files to modify**:

- `Launch10SitePicker.tsx` - Add full URL availability indicator below inputs
- New component or update `PageNameInput` to show full URL status

**Screenshot references**:

- "Selected website is currently unavailable" (red text)
- "Available: myphotos.launch10.com/pets" (green with checkmark)

---

### 1.6 "Site Already Launched" Error

**Status**: GAP

**Current**: Not implemented

**Design**: Shows error banner when user selects a site/path combo that's already deployed:

- "This site is currently launched. Please choose a different site that isn't already taken."

**Files to modify**:

- `Launch10SitePicker.tsx` - Add deployed site check
- Need API call or local check against existing website_urls

**Screenshot reference**: Red error banner in design

---

## 2. Functionality Gaps

### 2.1 DNS Verification

**Status**: GAP (MAJOR)

**Current**: No DNS verification at all. Custom domain picker shows instructions but doesn't verify.

**Design**:

- Active DNS verification via API
- Auto-polling every 30-60s
- Manual "Check DNS" button
- Status indicator (pending/verified/failed)

**Files to create**:

- `app/services/domains/dns_verification_service.rb`
- `app/workers/dns_verification_worker.rb`
- `useDnsVerification.ts` hook

**Files to modify**:

- `Domain` model - add fields
- `DomainsController` - add `verify_dns` action
- `CustomDomainPicker.tsx` - add status display

---

### 2.2 Real-Time Availability Checking

**Status**: GAP

**Current**: No availability check as user types. Only validates format.

**Design**:

- Debounced availability check on blur/submit
- Shows loading state during check
- Shows available/unavailable status

**Files to modify**:

- `SiteNameDropdown.tsx` - Add availability check on custom input
- Need to call `POST /api/v1/domains/search` when user enters custom subdomain
- Add loading/status states

---

### 2.3 Path Conflict Detection

**Status**: PARTIAL

**Current**: `PageNameInput` accepts `existingPaths` prop but it's NEVER populated

```tsx
// PageNameInput.tsx:63
existingPaths = [],  // Always empty!
```

**Design**: Should check if path exists on selected domain and show warning

**Files to modify**:

- `Launch10SitePicker.tsx` - Fetch and pass existing paths for selected domain
- Or call `POST /api/v1/website_urls/search` when domain+path selected

---

### 2.4 Deployed Site Detection

**Status**: GAP

**Current**: No check if domain/path combo is already deployed

**Design**:

- Show "This site is currently launched" error
- Prevent selection of already-deployed URLs
- (Note: User clarified same domain OK but needs unique path)

**Files to modify**:

- Need to track which website_urls are currently deployed
- Add check in `Launch10SitePicker.tsx`

---

## 3. Data Flow Gaps

### 3.1 Domain Context Missing Fields

**Status**: PARTIAL

**Current context_controller response**:

```json
{
  "existing_domains": [...],
  "platform_subdomain_credits": {...},
  "brainstorm_context": {...},
  "plan_tier": "starter"
}
```

**Missing from design requirements**:

- `dns_verification_status` for each domain (needed for custom domains)
- Which website_urls are currently deployed (for conflict detection)

**Files to modify**:

- `app/controllers/api/v1/context_controller.rb`
- Types in `shared/lib/api/`

---

### 3.2 Recommendation Availability Status

**Status**: PARTIAL

**Current**: AI recommendations include `availability: "existing" | "available" | "unknown"`

**Gap**:

- "unknown" status should trigger an availability check
- No re-verification of "available" recommendations (they could become taken)

**Files to modify**:

- `recommendDomains.ts` - Ensure all generated recommendations are verified via tool
- Frontend should re-check on selection if status is stale

---

## 4. Component State Gaps

### 4.1 First-Time User Flow

**Status**: OK (mostly)

**Current**: If no existing sites, shows suggestions only

**Gap**: Should hide "Your Existing Sites" section entirely (current code does this: `existingSites.length > 0 &&`)

---

### 4.2 All States from Design Matrix

From the screenshot showing the state matrix:

| State                             | Current Status                                                    |
| --------------------------------- | ----------------------------------------------------------------- |
| No Existing Sites (1st time user) | OK - shows suggestions only                                       |
| Existing Site correct for need    | PARTIAL - star shows but no "perfect for this use case" indicator |
| Existing Site but not correct     | PARTIAL - shows but doesn't clearly differentiate                 |
| Multiple existing, one correct    | OK - star shows on correct one                                    |
| Out of credits, existing matches  | PARTIAL - star shows, but "Create New Site" should be greyed out  |
| Out of credits, no match          | GAP - should show upgrade CTA prominently                         |

---

## 5. Removed/Outdated Files

From git status, these were deleted:

```
D stories/website/DomainSetup.stories.tsx
D stories/website/SetupCustomDomain.stories.tsx
D stories/website/SetupSubDomain.stories.tsx
```

**Note**: These likely contained old implementation. New `SiteNameDropdown.stories.tsx` was added but other component stories may be needed.

---

## 6. Priority-Ordered Implementation Roadmap

### Phase 1: Foundation (Database + API)

1. Add DNS verification fields to Domain model
2. Create DNS verification service
3. Add `verify_dns` endpoint
4. Update domain context serialization

### Phase 2: UI Structure Refactor

5. Move out-of-credits banner to top
6. Fix suffix display timing (only on focus)
7. Add lock icon and disable custom domain for Starter
8. Add full URL availability status display

### Phase 3: Real-Time Validation

9. Add debounced availability checking on custom subdomain input
10. Add path conflict detection (fetch existing paths)
11. Add deployed site detection

### Phase 4: DNS Verification UI

12. Create `useDnsVerification` hook with auto-polling
13. Add DNS status display to CustomDomainPicker
14. Add manual "Check DNS" button

### Phase 5: Polish & Edge Cases

15. Handle "unknown" availability status
16. Add "site already launched" error state
17. Ensure all design states are covered
18. Add comprehensive E2E tests

---

## Implementation Checklist

### Database & API

- [ ] Migration: add dns_verification_status, dns_last_checked_at, dns_error_message to domains
- [ ] Service: create `Domains::DnsVerificationService`
- [ ] Endpoint: add `POST /api/v1/domains/:id/verify_dns`
- [ ] Serialization: add DNS fields to domain_context response
- [ ] Serialization: add deployed status to website_urls in context

### Frontend - UI Structure

- [ ] Move out-of-credits banner to top of picker
- [ ] Change suffix display to only show on input focus
- [ ] Add lock icon to "Connect your own site" for Starter
- [ ] Disable custom domain click for Starter plan
- [ ] Add full URL availability indicator (red/green status)
- [ ] Add "site already launched" error banner

### Frontend - Validation

- [ ] Add debounced availability check on custom subdomain input
- [ ] Pass existing paths to PageNameInput (fetch from selected domain)
- [ ] Add deployed site detection and error

### Frontend - DNS Verification

- [ ] Create `useDnsVerification` hook
- [ ] Add DNS status component (pending/verified/failed)
- [ ] Integrate auto-polling into CustomDomainPicker
- [ ] Add manual "Check DNS" button

### Testing

- [ ] Unit tests for DnsVerificationService
- [ ] API tests for verify_dns endpoint
- [ ] E2E test: custom subdomain availability checking
- [ ] E2E test: path conflict detection
- [ ] E2E test: DNS verification flow
- [ ] E2E test: out of credits states
- [ ] E2E test: plan gating for custom domains
