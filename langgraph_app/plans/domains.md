# Domain Picker Implementation Plan

## Overview

Add a "domain" substep to the website workflow page, triggered by the Continue button in PaginationFooter. This implements a **multi-step agent flow** that:

1. Recommends the best subdomain (existing or new)
2. Queries existing paths on that subdomain and recommends an available path
3. Supports both Launch10 subdomains (.launch10.site) AND custom domains

## Key Decisions

- **Location**: New "domain" substep on the "website" workflow page
- **Trigger**: Continue button in PaginationFooter → shows Domain Picker
- **Availability**: Both during initial creation AND deploy flow
- **Custom Domains**: In scope with CNAME instructions

## Current State (What Exists)

| Component                       | Status                   | Salvageable                      |
| ------------------------------- | ------------------------ | -------------------------------- |
| `recommendDomains` node         | Works for subdomain only | 70% - add path logic             |
| Rails domain context API        | Complete                 | 90% - has `website_urls` already |
| Rails `website_urls/search` API | Exists                   | 100% - ready to use              |
| `SubdomainPicker` component     | In wrong location        | 40% - needs redesign             |
| Types and hooks                 | Good                     | 90% - add path field             |
| Tests                           | Comprehensive            | 60% - update for paths           |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MULTI-STEP AGENT FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: Domain Selection                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Input: brainstorm context, existing domains, credits        │   │
│  │ LLM Decision: Is there an existing domain that fits?        │   │
│  │ Output: selectedDomain (existing ID or new subdomain)       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  Step 2: Path Recommendation                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ If existing domain selected:                                │   │
│  │   - Query existing paths via searchWebsiteUrlsTool          │   │
│  │   - LLM generates path that doesn't conflict                │   │
│  │ If new domain:                                              │   │
│  │   - Recommend "/" or derive from page purpose               │   │
│  │ Output: recommendedPath                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  Final Output: { domain, path, fullUrl }                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

---

## Phase 0: Workflow Configuration (Foundation)

### 0.1 Add Website Substeps to Workflow Config

**File:** `shared/config/workflow.ts`

```typescript
// Add website substeps (mirrors ad_campaign pattern)
export const WebsiteSubstepNames = ["build", "domain", "deploy"] as const;
export type WebsiteSubstepName = typeof WebsiteSubstepNames[number];

// Update SubstepNames to include website substeps
export const SubstepNames = [...AdCampaignSubstepNames, ...WebsiteSubstepNames] as const;

// Update workflows config
{
  name: "website",
  label: "Landing Page",
  order: 2,
  steps: [
    { name: "build", label: "Build", order: 1 },
    { name: "domain", label: "Website Setup", order: 2 },
    { name: "deploy", label: "Deploy", order: 3 }
  ]
}
```

### 0.2 Update workflowNavigation.ts

**File:** `rails_app/app/javascript/frontend/lib/workflowNavigation.ts`

```typescript
// Add website substep order
const WEBSITE_SUBSTEP_ORDER: Workflow.WebsiteSubstepName[] = ["build", "domain", "deploy"];

// Update getFirstSubstep
export function getFirstSubstep(page: Workflow.WorkflowPage): Workflow.SubstepName | null {
  switch (page) {
    case "brainstorm":
      return null;
    case "website":
      return "build"; // Start at build
    case "ad_campaign":
      return "content";
    case "deploy":
      return null; // deploy page still has no substeps (or remove from workflow)
  }
}

// Update pageHasSubsteps
export function pageHasSubsteps(page: Workflow.WorkflowPage | null): boolean {
  return page === "ad_campaign" || page === "website";
}

// Update continueWorkflow
if (page === "website") {
  const nextSubstep = getNextWebsiteSubstep(substep);
  if (nextSubstep) {
    return { page: "website", substep: nextSubstep };
  }
  // End of website → go to ad_campaign
  return { page: "ad_campaign", substep: "content" };
}

// Update backWorkflow
if (page === "website") {
  const prevSubstep = getPrevWebsiteSubstep(substep);
  if (prevSubstep) {
    return { page: "website", substep: prevSubstep };
  }
  // At first substep → go back to brainstorm
  return { page: "brainstorm", substep: null };
}

if (page === "ad_campaign") {
  const prevSubstep = getPrevAdCampaignSubstep(substep);
  if (prevSubstep) {
    return { page: "ad_campaign", substep: prevSubstep };
  }
  // At first substep → go back to website/deploy
  return { page: "website", substep: "deploy" };
}

// Add helper functions
function getNextWebsiteSubstep(
  current: Workflow.SubstepName | null
): Workflow.WebsiteSubstepName | null {
  if (!current) return "build";
  const currentIndex = WEBSITE_SUBSTEP_ORDER.indexOf(current as Workflow.WebsiteSubstepName);
  if (currentIndex === -1 || currentIndex >= WEBSITE_SUBSTEP_ORDER.length - 1) return null;
  return WEBSITE_SUBSTEP_ORDER[currentIndex + 1];
}

function getPrevWebsiteSubstep(
  current: Workflow.SubstepName | null
): Workflow.WebsiteSubstepName | null {
  if (!current) return null;
  const currentIndex = WEBSITE_SUBSTEP_ORDER.indexOf(current as Workflow.WebsiteSubstepName);
  if (currentIndex <= 0) return null;
  return WEBSITE_SUBSTEP_ORDER[currentIndex - 1];
}
```

### 0.3 Update workflowStore.ts

**File:** `rails_app/app/javascript/frontend/stores/workflowStore.ts`

```typescript
// Update parseUrl - add website substep matching
const websiteSubstepMatch = path.match(/^\/projects\/([^/]+)\/website\/(build|domain|deploy)$/);
if (websiteSubstepMatch) {
  const substep = websiteSubstepMatch[2] as Workflow.WebsiteSubstepName;
  return { projectUUID: websiteSubstepMatch[1], page: "website", substep };
}

// Keep existing website match for backwards compatibility (redirects to /build)
const websiteMatch = path.match(/^\/projects\/([^/]+)\/website$/);
if (websiteMatch) {
  return { projectUUID: websiteMatch[1], page: "website", substep: "build" };
}

// Update buildUrl
case "website":
  // Always include substep for website
  return `/projects/${projectUUID}/website/${substep ?? "build"}`;
```

### 0.4 Update Rails Controller (Mirrors Ad Campaign Pattern)

**File:** `rails_app/app/controllers/projects_controller.rb`

```ruby
# Remove the single website action
# def website
#   ...
# end

# Add dynamic substep methods like ad_campaign
WorkflowConfig.substeps_for("launch", "website").each do |substep|
  define_method("website_#{substep}") do
    # Advance workflow substep
    @project.current_workflow.update!(step: "website", substep: substep)

    render inertia: "Website",
      props: @project.to_website_json.merge(substep: substep),
      layout: "layouts/webcontainer"
  end
end
```

### 0.5 Update Routes

**File:** `rails_app/config/routes.rb`

```ruby
# Add website substep routes
get "projects/:uuid/website/build", to: "projects#website_build"
get "projects/:uuid/website/domain", to: "projects#website_domain"
get "projects/:uuid/website/deploy", to: "projects#website_deploy"

# Redirect bare /website to /website/build
get "projects/:uuid/website", to: redirect("/projects/%{uuid}/website/build")
```

### 0.6 Update WorkflowConfig (if needed)

**File:** `rails_app/lib/workflow_config.rb` (or similar)

Ensure `WorkflowConfig.substeps_for("launch", "website")` returns `["build", "domain", "deploy"]`

---

## Phase 1: Extend Langgraph Node for Path Recommendations

### 1.1 Create `searchWebsiteUrlsTool`

**File:** `langgraph_app/app/tools/website/searchWebsiteUrls.ts`

```typescript
export function createSearchWebsiteUrlsTool(jwt: string) {
  return tool(
    async ({ domainId, candidates }) => {
      const api = new WebsiteUrlsAPIService({ jwt });
      return api.search(domainId, candidates);
    },
    {
      name: "search_website_urls",
      description:
        "Check if paths are available on a specific domain. Use after selecting a domain to find an available path.",
      schema: z.object({
        domainId: z.number().describe("The domain ID to check paths on"),
        candidates: z
          .array(z.string())
          .max(10)
          .describe("Paths to check (e.g., '/landing', '/promo')"),
      }),
    }
  );
}
```

### 1.2 Create `WebsiteUrlsAPIService`

**File:** `shared/lib/api/services/websiteUrlsAPIService.ts`

```typescript
export class WebsiteUrlsAPIService extends RailsAPIBase {
  async search(domainId: number, candidates: string[]): Promise<PathSearchResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/website_urls/search", {
      body: { domain_id: domainId, candidates },
    });
    return response.data;
  }
}
```

### 1.3 Update `recommendDomains` Node - Two-Phase Agent

**File:** `langgraph_app/app/nodes/website/recommendDomains.ts`

```typescript
// Phase 1: Domain Selection
// - Score existing domains
// - Generate new domain suggestions if has credits
// - Select best domain

// Phase 2: Path Recommendation (conditional)
// - If existing domain selected: use search_website_urls tool to get existing paths
// - Generate path candidates based on page purpose
// - Check availability and select best path
// - If new domain: default to "/" or derive from content
```

### 1.4 Update Prompt with Path Instructions

**File:** `langgraph_app/app/prompts/website/recommendDomains.ts`

Add to system prompt:

```
PHASE 2: PATH RECOMMENDATION
After selecting the best domain:

1. If selecting an EXISTING domain with high score:
   - Use the search_website_urls tool with the domain's ID
   - Pass candidate paths derived from the page purpose
   - Paths MUST be single-level (e.g., "/landing" NOT "/marketing/landing")
   - Choose a path that doesn't conflict with existing paths

2. If recommending a NEW domain:
   - Default path is "/" for the main page
   - Or derive from the page's primary purpose

3. Path naming guidelines:
   - Use lowercase letters, numbers, hyphens only
   - Keep it short and descriptive (e.g., "/promo", "/launch", "/beta")
   - Avoid generic paths like "/page" or "/landing" if more specific fits
```

### 1.5 Update Types with Path Field

**File:** `shared/types/website/domainRecommendations.ts`

```typescript
export interface DomainRecommendation {
  domain: string;
  subdomain: string;
  path: string; // NEW: "/landing", "/", etc.
  fullUrl: string; // NEW: "mysite.launch10.site/landing"
  score: number;
  reasoning: string;
  source: "existing" | "generated";
  existingId?: number;
  existingDomainId?: number; // NEW: For path search tool
  availability?: "available" | "existing" | "unavailable" | "unknown";
}
```

---

## Phase 2: Create Domain Picker UI Components

### 2.1 Create DomainPicker Container

**File:** `rails_app/app/javascript/frontend/components/website/domain-picker/DomainPicker.tsx`

Main container with two modes:

- **Launch10 Site mode** (default): Subdomain picker + path input
- **Custom Domain mode**: Domain input + path input + CNAME instructions

```tsx
export function DomainPicker({ websiteId, onComplete }: Props) {
  const [mode, setMode] = useState<"launch10" | "custom">("launch10");

  return (
    <div className="domain-picker">
      <Header title={mode === "launch10" ? "Website Setup" : "Connect your own site"} />

      {mode === "launch10" ? (
        <Launch10SitePicker onSwitchToCustom={() => setMode("custom")} />
      ) : (
        <CustomDomainPicker onSwitchToLaunch10={() => setMode("launch10")} />
      )}
    </div>
  );
}
```

### 2.2 Create Launch10SitePicker

**File:** `rails_app/app/javascript/frontend/components/website/domain-picker/Launch10SitePicker.tsx`

Two inputs side by side:

- **Your site name**: Dropdown with existing sites + suggestions + custom input
- **Page Name**: Input for path with "/" prefix

```tsx
<div className="flex gap-4">
  <SiteNameDropdown
    recommendations={recommendations}
    selected={selectedDomain}
    onSelect={setSelectedDomain}
  />
  <PageNameInput
    domainId={selectedDomain?.existingDomainId}
    existingPaths={existingPaths}
    recommended={recommendedPath}
    value={path}
    onChange={setPath}
  />
</div>
```

### 2.3 Create SiteNameDropdown

**File:** `rails_app/app/javascript/frontend/components/website/domain-picker/SiteNameDropdown.tsx`

Sections:

1. **Your Existing Sites** - with star for recommended, shows existing paths
2. **Create New Site (Suggestions)** - AI-generated suggestions
3. **Type to create your own** - Custom input

### 2.4 Create PageNameInput

**File:** `rails_app/app/javascript/frontend/components/website/domain-picker/PageNameInput.tsx`

- Input with "/" prefix
- Shows AI-recommended path
- Validates single-level
- Shows availability status

### 2.5 Create CustomDomainPicker

**File:** `rails_app/app/javascript/frontend/components/website/domain-picker/CustomDomainPicker.tsx`

Based on Figma design:

```tsx
<div className="custom-domain">
  <div className="flex gap-4">
    <Input label="Your site name" placeholder="yourdomain.com" />
    <PageNameInput ... />
  </div>

  <Link onClick={onSwitchToLaunch10}>Use a Launch10 Site →</Link>

  <CNAMEInstructions
    recordName="CNAME"
    host="www"
    pointsTo="cname.launch10.ai"
  />

  <DNSProviderGuides providers={["Cloudflare", "GoDaddy", "Namecheap", "AWS Route 53"]} />
</div>
```

### 2.6 Create FullUrlPreview

**File:** `rails_app/app/javascript/frontend/components/website/domain-picker/FullUrlPreview.tsx`

Shows combined URL: `mysite.launch10.site/landing` with status indicator

---

## Phase 3: Wire Up Website Page Substep Routing

### 3.1 Update Website Page to Handle Substeps

**File:** `rails_app/app/javascript/frontend/pages/projects/Website.tsx`

The Website page receives a `substep` prop from the controller and renders the appropriate view:

```tsx
interface WebsitePageProps {
  substep: "build" | "domain" | "deploy";
  // ... other props
}

export default function Website({ substep, ...props }: WebsitePageProps) {
  return (
    <WebsiteLayout>
      {substep === "build" && <WebsiteBuilder {...props} />}
      {substep === "domain" && <DomainPicker {...props} />}
      {substep === "deploy" && <WebsiteDeploy {...props} />}
    </WebsiteLayout>
  );
}
```

### 3.2 Create WebsiteDeploy Component

**File:** `rails_app/app/javascript/frontend/components/website/deploy/WebsiteDeploy.tsx`

The deploy step shows:

- Selected domain + path summary
- Deploy button
- Deploy status/progress
- Link to live site when complete

### 3.3 Remove from QuickActions

**File:** `rails_app/app/javascript/frontend/components/website/sidebar/quick-actions/QuickActions.tsx`

- Remove "Connect Domain" action
- Remove `SubdomainPickerSection`

---

## Files Summary

### Langgraph (5 files)

| File                                                 | Change                     |
| ---------------------------------------------------- | -------------------------- |
| `app/tools/website/searchWebsiteUrls.ts`             | **NEW** - Path search tool |
| `app/tools/website/index.ts`                         | Export new tool            |
| `app/nodes/website/recommendDomains.ts`              | Add two-phase path logic   |
| `app/prompts/website/recommendDomains.ts`            | Add path instructions      |
| `tests/tests/nodes/website/recommendDomains.test.ts` | Add path tests             |

### Shared (4 files)

| File                                               | Change                                       |
| -------------------------------------------------- | -------------------------------------------- |
| `shared/config/workflow.ts`                        | Add website substeps (build, domain, deploy) |
| `shared/lib/api/services/websiteUrlsAPIService.ts` | **NEW**                                      |
| `shared/lib/api/services/index.ts`                 | Export new service                           |
| `shared/types/website/domainRecommendations.ts`    | Add path field                               |

### Rails Backend (3 files)

| File                                     | Change                                  |
| ---------------------------------------- | --------------------------------------- |
| `app/controllers/projects_controller.rb` | Add website_build/domain/deploy actions |
| `config/routes.rb`                       | Add website substep routes              |
| `lib/workflow_config.rb`                 | Add website substeps config (if needed) |

### Rails Frontend (12+ files)

| File                                                        | Change                                          |
| ----------------------------------------------------------- | ----------------------------------------------- |
| `stores/workflowStore.ts`                                   | Handle website substeps (build, domain, deploy) |
| `lib/workflowNavigation.ts`                                 | Update transitions with website substep helpers |
| `pages/projects/Website.tsx`                                | Handle substep prop for rendering correct view  |
| `components/website/domain-picker/DomainPicker.tsx`         | **NEW**                                         |
| `components/website/domain-picker/Launch10SitePicker.tsx`   | **NEW**                                         |
| `components/website/domain-picker/SiteNameDropdown.tsx`     | **NEW**                                         |
| `components/website/domain-picker/PageNameInput.tsx`        | **NEW**                                         |
| `components/website/domain-picker/CustomDomainPicker.tsx`   | **NEW**                                         |
| `components/website/domain-picker/FullUrlPreview.tsx`       | **NEW**                                         |
| `components/website/domain-picker/index.ts`                 | **NEW**                                         |
| `components/website/deploy/WebsiteDeploy.tsx`               | **NEW** - Deploy step UI                        |
| `components/website/sidebar/quick-actions/QuickActions.tsx` | Remove domain action                            |
| `api/domainContext.hooks.ts`                                | Add websiteUrl hooks                            |

---

## Verification

### E2E Testing with CACHE_MODE

Use `CACHE_MODE=true` to skip the website build step and test with a pre-built website. This allows testing the domain picker and deploy flow without waiting for AI generation.

**Test file:** `rails_app/tests/e2e/website-domain-picker.spec.ts`

```bash
# Run domain picker E2E tests with cached website
cd rails_app && CACHE_MODE=true pnpm test:e2e -- --grep "domain-picker"
```

**E2E Test Scenarios:**

1. **First-time user (no existing sites)**
   - User has no existing domains
   - Shows "Create New Site" with 2 suggestions
   - Can type custom subdomain
   - Can select suggested subdomain
   - Path defaults to "/" for new domain
   - Full URL preview shows correctly

2. **User with existing site that fits**
   - User has existing domain that scores high
   - "Your Existing Sites" shows with star on recommended
   - Can select existing domain
   - Path picker shows existing paths on that domain
   - Can select new path that doesn't conflict

3. **User with existing site that doesn't fit**
   - User has existing domain that scores low
   - "Create New Site" suggestion is highlighted
   - "Your Existing Sites" shows but not recommended
   - Can override and select existing domain anyway

4. **Out of subdomain credits**
   - User has used all subdomain credits
   - "Create New Site" is disabled
   - Shows upgrade CTA
   - Can still use existing domains

5. **Custom domain mode**
   - Click "Connect your own site"
   - Enter custom domain
   - See CNAME instructions
   - See DNS provider guides
   - Can switch back to Launch10 site

6. **Navigation flow**
   - `/website/build` → Continue → `/website/domain`
   - `/website/domain` → Continue → `/website/deploy`
   - `/website/deploy` → Back → `/website/domain`
   - `/website/domain` → Back → `/website/build`

### Unit Tests

```bash
# Langgraph node tests (with path logic)
cd langgraph_app && pnpm test -- --grep "domainRecommendations"

# Rails API tests
cd rails_app && bundle exec rspec spec/requests/api/v1/website_urls_spec.rb

# Frontend component tests
cd rails_app && pnpm test -- --grep "DomainPicker"
```

### Manual Testing (if needed)

```bash
cd rails_app && bin/dev
# Navigate to existing project → website → continue to domain picker
```
