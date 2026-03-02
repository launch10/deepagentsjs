# Domain Picker Feature - Complete Requirements Specification

## Overview

The Domain Picker is a smart, AI-powered component that helps users select or create the best domain/path combination for their landing page. It integrates plan-based limits, AI recommendations, real-time availability checking, and DNS verification for custom domains.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ DomainPicker │  │ SiteNameDrop │  │ CustomDomainPicker    │ │
│  │   (React)    │  │    down      │  │ (DNS Instructions)    │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
└─────────┼─────────────────┼──────────────────────┼──────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                         RAILS API                                │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │ DomainContext  │  │ DomainsSearch  │  │ DNS Verification │  │
│  │   Endpoint     │  │   Endpoint     │  │    Endpoint      │  │
│  └────────┬───────┘  └────────┬───────┘  └────────┬─────────┘  │
└───────────┼───────────────────┼───────────────────┼─────────────┘
            │                   │                   │
            ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌─────────┐  ┌────────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Domain  │  │ WebsiteUrl │  │ TierLimit │  │ Subscription │  │
│  │ (model) │  │  (model)   │  │ (credits) │  │   (plan)     │  │
│  └────┬────┘  └─────┬──────┘  └───────────┘  └──────────────┘  │
└───────┼─────────────┼───────────────────────────────────────────┘
        │             │
        ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ATLAS (Cloudflare Worker)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Routes: *.launch10.site/* → KV lookup → R2 file serve   │   │
│  │  Admin API: Sync domain/website-url records from Rails   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LANGGRAPH (AI Recommendations)                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  recommendDomains node → searchDomains tool → scored     │   │
│  │  recommendations with relevance to brainstorm context    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Terminology

- **Platform Subdomain**: A `.launch10.site` subdomain (e.g., `myphotos.launch10.site`)
- **Custom Domain**: User's own domain (e.g., `mybusiness.com`) - requires Growth/Pro plan
- **WebsiteURL**: A domain + path combination (e.g., `myphotos.launch10.site/pets`)
- **Domain**: The root domain record (can have multiple paths)

### Key Constraints

- Paths must be single-level only (e.g., `/pets` not `/pets/dogs`)
- Same domain can have multiple paths (each path = unique WebsiteURL)
- Each project needs a unique WebsiteURL (domain + path combination)
- Platform subdomains are limited by plan tier

---

## Plan-Based Limits (ACTUAL VALUES)

| Feature             | Starter   | Growth    | Pro        |
| ------------------- | --------- | --------- | ---------- |
| Platform subdomains | **1**     | **2**     | **3**      |
| Custom domains      | No        | Yes       | Yes        |
| Requests per month  | 1,000,000 | 5,000,000 | 20,000,000 |

Source: `spec/snapshot_builders/core/tier_limits.rb:5`

```ruby
"platform_subdomains" => {starter: 1, growth: 2, pro: 3}
```

---

## Data Requirements

### 1. User Context Data

| Data Point                 | Source                             | Purpose                                      |
| -------------------------- | ---------------------------------- | -------------------------------------------- |
| Existing domains           | `domains` table                    | Show user's available domains                |
| WebsiteURLs per domain     | `website_urls` table               | Show existing paths on each domain           |
| Platform subdomain credits | `tier_limits.platform_subdomains`  | Determine if user can create new subdomains  |
| Plan tier                  | `subscriptions → plan → plan_tier` | Gate custom domain feature (Growth/Pro only) |
| Brainstorm context         | `brainstorms` table                | Feed AI for relevant recommendations         |

### 2. Availability Data

| Check Type              | When Needed                       | API                                    |
| ----------------------- | --------------------------------- | -------------------------------------- |
| Subdomain availability  | User types new subdomain          | `POST /api/v1/domains/search`          |
| Path availability       | User selects domain + enters path | `POST /api/v1/website_urls/search`     |
| DNS verification status | Custom domain setup               | `POST /api/v1/domains/{id}/verify_dns` |

### 3. AI Recommendation Data

| Input                                 | Output                                |
| ------------------------------------- | ------------------------------------- |
| Brainstorm (idea, audience, solution) | Scored domain+path recommendations    |
| Existing domains + paths              | Relevance scores for existing options |
| Available credits                     | Whether to suggest new subdomains     |

---

## API Design

### API 1: Domain Context

**Endpoint**: `GET /api/v1/websites/{id}/domain_context`

**Purpose**: Fetch all context needed for domain picker initialization

**Response**:

```json
{
  "existing_domains": [
    {
      "id": 123,
      "domain": "myphotos.launch10.site",
      "is_platform_subdomain": true,
      "website_id": 456,
      "website_name": "My Pet Photos",
      "website_urls": [
        { "id": 1, "path": "/", "website_id": 456 },
        { "id": 2, "path": "/pets", "website_id": 789 }
      ],
      "dns_verification_status": null,
      "created_at": "2026-01-15T10:00:00Z"
    },
    {
      "id": 124,
      "domain": "mybusiness.com",
      "is_platform_subdomain": false,
      "website_id": null,
      "website_name": null,
      "website_urls": [],
      "dns_verification_status": "verified",
      "created_at": "2026-01-20T14:30:00Z"
    }
  ],
  "platform_subdomain_credits": {
    "limit": 2,
    "used": 1,
    "remaining": 1
  },
  "brainstorm_context": {
    "id": 789,
    "idea": "Pet photography business",
    "audience": "Pet owners in Seattle",
    "solution": "Professional pet portraits at affordable prices",
    "social_proof": "500+ happy pet parents"
  },
  "plan_tier": "growth"
}
```

### API 2: Domain Availability Search

**Endpoint**: `POST /api/v1/domains/search`

**Purpose**: Check if requested subdomains are available globally

**Request**:

```json
{
  "candidates": ["petphotos", "pawportraits", "mypetpics"]
}
```

**Response**:

```json
{
  "results": [
    {
      "subdomain": "petphotos",
      "domain": "petphotos.launch10.site",
      "status": "available",
      "existing_id": null
    },
    {
      "subdomain": "pawportraits",
      "domain": "pawportraits.launch10.site",
      "status": "unavailable",
      "existing_id": null
    },
    {
      "subdomain": "mypetpics",
      "domain": "mypetpics.launch10.site",
      "status": "existing",
      "existing_id": 123
    }
  ],
  "platform_subdomain_credits": {
    "limit": 2,
    "used": 1,
    "remaining": 1
  }
}
```

**Status values**:

- `available`: No one owns this subdomain, user can claim it
- `unavailable`: Another user owns this subdomain
- `existing`: Current user already owns this subdomain

### API 3: Path Availability Search

**Endpoint**: `POST /api/v1/website_urls/search`

**Purpose**: Check if paths are available on a specific domain

**Request**:

```json
{
  "domain_id": 123,
  "candidates": ["/pets", "/dogs", "/portraits"]
}
```

**Response**:

```json
{
  "domain_id": 123,
  "domain": "myphotos.launch10.site",
  "results": [
    { "path": "/pets", "status": "existing", "website_id": 456 },
    { "path": "/dogs", "status": "available", "website_id": null },
    { "path": "/portraits", "status": "available", "website_id": null }
  ]
}
```

### API 4: DNS Verification (NEW)

**Endpoint**: `POST /api/v1/domains/{id}/verify_dns`

**Purpose**: Check if custom domain's DNS is correctly configured

**How it works**:

1. User enters custom domain (e.g., `mybusiness.com`)
2. Rails creates Domain record with `dns_verification_status: "pending"`
3. User configures DNS at their registrar (CNAME pointing to `cname.launch10.com`)
4. Frontend calls this endpoint to check status
5. Rails performs DNS lookup to verify CNAME record
6. If verified, domain is synced to Atlas worker

**Request**: No body needed

**Response**:

```json
{
  "domain_id": 124,
  "domain": "mybusiness.com",
  "verification_status": "verified",
  "expected_cname": "cname.launch10.com",
  "actual_cname": "cname.launch10.com",
  "last_checked_at": "2026-02-01T10:30:00Z",
  "error_message": null
}
```

**Verification statuses**:

- `pending`: DNS not yet configured or propagating
- `verified`: CNAME correctly points to `cname.launch10.com`
- `failed`: Wrong CNAME value or DNS error

**Auto-polling**:

- Frontend polls every 30-60 seconds while user is on page
- Also provides manual "Check DNS" button
- Stops polling once `verified`

### API 5: AI Recommendations (Langgraph)

**Node**: `recommendDomains` in website graph

**Input Context** (from Rails domain_context endpoint):

- Brainstorm data (idea, audience, solution, social_proof)
- Existing domains with their paths
- Platform subdomain credits

**Tools Available**:

- `searchDomains`: Check availability of generated subdomain candidates
- `searchPaths`: Check path availability on existing domains

**Output**:

```json
{
  "state": "existing_recommended",
  "recommendations": [
    {
      "domain": "pawportraits.launch10.site",
      "subdomain": "pawportraits",
      "path": "/pets",
      "fullUrl": "pawportraits.launch10.site/pets",
      "score": 92,
      "reasoning": "Matches pet photography business perfectly. 'Paw portraits' captures both the pet focus and professional service.",
      "source": "existing",
      "existingDomainId": 123,
      "availability": "existing"
    },
    {
      "domain": "petphotos.launch10.site",
      "subdomain": "petphotos",
      "path": "/",
      "fullUrl": "petphotos.launch10.site",
      "score": 85,
      "reasoning": "Clear and descriptive for a pet photography service.",
      "source": "generated",
      "existingDomainId": null,
      "availability": "available"
    }
  ],
  "topRecommendation": {
    /* first item above */
  }
}
```

**State values**:

- `no_existing_sites`: User has no domains, show generated recommendations
- `existing_recommended`: User's existing domain scores 80+ (best match)
- `new_recommended`: No good existing match, but user has credits for new subdomain
- `out_of_credits_no_match`: No credits AND no matching existing domain

---

## UI States Matrix

### User Scenarios

| Scenario                           | Has Sites | Credits Left | Existing Match (80+) | Star Location                      |
| ---------------------------------- | --------- | ------------ | -------------------- | ---------------------------------- |
| First-time user                    | No        | Yes          | N/A                  | Suggestions section                |
| Has perfect match                  | Yes       | Any          | Yes                  | Existing Sites section             |
| Has sites, none match, has credits | Yes       | Yes          | No                   | Suggestions section                |
| Has sites, none match, no credits  | Yes       | No           | No                   | Existing Sites (upgrade CTA shown) |
| Has match, no credits              | Yes       | No           | Yes                  | Existing Sites section             |

### Dropdown Sections (in order)

**1. Create New Site**

- Text input with `.launch10.site` suffix shown on focus
- Validates on blur/submit with debounce
- Greyed out + disabled if no credits remaining
- Shows validation errors inline

**2. Your Existing Sites**

- List of user's domains with their paths
- Star icon on AI-recommended item (if source = "existing")
- Shows all existing options regardless of match quality
- Sorted by recommendation score descending

**3. Create New Site (Suggestions)**

- AI-generated available subdomain suggestions
- Only shown if user has credits remaining
- Star icon on top recommendation (if source = "generated")
- 2-3 pre-verified available options
- Hidden entirely if no credits

**4. Connect your own site**

- Link to custom domain flow
- Locked with badge for Starter plan users
- Shows "Available on Growth & Pro Plan" indicator
- Leads to CustomDomainPicker component

### Star Icon Rules

- Exactly ONE item gets the star across all sections
- Based on AI's top recommendation (highest score)
- Threshold: 80+ score for "recommended" status
- Can be in "Existing Sites" OR "Suggestions" section
- Star icon with label "Recommended"

---

## Custom Domain Flow

### Prerequisites

- User must be on Growth or Pro plan
- User must have a domain they control

### Setup Steps

**Step 1: Enter Domain**

- User clicks "Connect your own site"
- Enters domain name (e.g., `mybusiness.com`)
- Rails creates Domain record with `dns_verification_status: "pending"`

**Step 2: DNS Configuration Instructions**
Display the following:

```
What you need to configure:

Record Type: CNAME
Host:        www (or @ for root)
Points to:   cname.launch10.com
```

**Step 3: Provider Guides**
Link to setup guides for common providers:

- Cloudflare
- GoDaddy
- Namecheap
- AWS Route 53

**Step 4: Verification**

- Auto-poll DNS every 30-60 seconds
- Show status indicator:
  - Pending: "Waiting for DNS to propagate..."
  - Verified: "DNS verified! Your domain is ready."
  - Failed: "DNS not configured correctly. Check your settings."
- Manual "Check DNS" button for impatient users

**Step 5: Ready for Deploy**

- Once verified, domain is synced to Atlas
- User can select path and proceed to deploy

### Deploy Behavior with Unverified DNS

- Allow deploy to proceed with warning
- Message: "Your site is being deployed. Note: It may not be accessible at your custom domain until DNS propagates (up to 48 hours)."
- Background job continues checking DNS
- In-app notification when verified

---

## Atlas Integration

### How Platform Subdomains Work

1. **Wildcard DNS**: `*.launch10.site` CNAME → Cloudflare Worker
2. **Worker Route**: `*.launch10.site/*` pattern in `wrangler-public.toml`
3. **Request Flow**:

   ```
   Request: https://myphotos.launch10.site/pets/pricing

   1. Extract: hostname="myphotos.launch10.site", pathname="/pets/pricing"
   2. KV lookup: Find WebsiteUrl for domain + longest path match
   3. Match: WebsiteUrl{domain: "myphotos.launch10.site", path: "/pets"}
   4. Strip path: /pets/pricing → /pricing
   5. R2 key: production/{website_id}/live/pricing/index.html
   6. Serve file or SPA fallback
   ```

### How Custom Domains Work

1. **User DNS**: Points domain to Cloudflare (CNAME to `cname.launch10.com`)
2. **Cloudflare Zone**: Must be configured for the custom domain
3. **Rails → Atlas Sync**: After DNS verification, sync Domain record to Atlas KV
4. **Worker handles**: Same path matching logic applies

### Rails → Atlas Sync

When Domain or WebsiteUrl is created/updated in Rails:

1. `Atlas::Domain` concern triggers callback
2. `Atlas::DomainService` sends HTTP request to Atlas admin API
3. Atlas stores in KV: `{env}:domain:{id}` and indexes

---

## Validation Rules

### Subdomain Validation

```
Pattern: ^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$
Max length: 63 characters (DNS spec)
Transforms: Lowercase (auto-convert)
Forbidden: Leading/trailing hyphens
Restricted: uploads, dev-uploads, staging, www, api
```

### Path Validation

```
Pattern: ^\/[a-z0-9-]*$
Constraint: Single-level only (no nested paths)
Max length: 50 characters
Transforms: Lowercase (auto-convert)
Required: Must start with /
```

**Why single-level only?**
Atlas worker's path matching uses longest-prefix-match. Single-level paths simplify routing and ensure predictable behavior. Multi-level paths like `/marketing/campaign` would require more complex prefix stripping logic.

### Custom Domain Validation

```
Format: Valid domain (foo.com, sub.foo.com)
Forbidden: *.launch10.site (use platform subdomain instead)
Required: DNS verification before deploy
```

---

## Error States & Messages

| Error                    | Message                                                                 | Recovery Action                          |
| ------------------------ | ----------------------------------------------------------------------- | ---------------------------------------- |
| Subdomain taken          | "This site name is already taken"                                       | Show alternative suggestions             |
| Path exists on domain    | "This path already exists on [domain]"                                  | Show available paths or different domain |
| Out of subdomain credits | "You've hit the limit of X subdomains on your plan"                     | Upgrade CTA or use existing              |
| DNS pending              | "DNS not yet configured - propagation can take up to 48 hours"          | Show instructions + check button         |
| DNS failed               | "CNAME record not found. Expected: cname.launch10.com"                   | Re-show setup instructions               |
| Invalid subdomain format | "Site name can only contain letters, numbers, and hyphens"              | Inline field error                       |
| Invalid path format      | "Path must start with / and contain only letters, numbers, and hyphens" | Inline field error                       |
| Custom domain on Starter | "Custom domains require Growth or Pro plan"                             | Upgrade CTA                              |

---

## Implementation Checklist

### Backend - Rails

**New Files**:

- [ ] `app/services/domains/dns_verification_service.rb` - DNS lookup logic
- [ ] `app/workers/dns_verification_worker.rb` - Background polling job
- [ ] `db/migrate/xxx_add_dns_verification_to_domains.rb` - Migration

**Modifications**:

- [ ] `app/controllers/api/v1/domains_controller.rb` - Add `verify_dns` action
- [ ] `app/models/domain.rb` - Add dns_verification_status, dns_last_checked_at, dns_error_message fields
- [ ] `app/controllers/api/v1/context_controller.rb` - Include dns_verification_status in response
- [ ] `app/models/concerns/domain_concerns/serialization.rb` - Update serialization

**Database Changes**:

```ruby
add_column :domains, :dns_verification_status, :string, default: nil
add_column :domains, :dns_last_checked_at, :datetime
add_column :domains, :dns_error_message, :string
add_index :domains, :dns_verification_status
```

### Backend - Langgraph

**Modifications**:

- [ ] `app/nodes/website/recommendDomains.ts` - Ensure output format matches spec
- [ ] `app/prompts/website/recommendDomains.ts` - Include path recommendations in prompt
- [ ] `app/tools/website/searchDomains.ts` - Verify response format
- [ ] `app/tools/website/searchPaths.ts` - Verify response format

### Frontend - React

**Components to Update**:

- [ ] `DomainPicker.tsx` - Orchestrate all states
- [ ] `SiteNameDropdown.tsx` - Implement star logic, section ordering
- [ ] `CustomDomainPicker.tsx` - Add DNS verification status + auto-poll
- [ ] `Launch10SitePicker.tsx` - Connect credit display + restrictions
- [ ] `PageNameInput.tsx` - Path validation

**New Hooks**:

- [ ] `useDnsVerification(domainId)` - Auto-polling hook for DNS status

**API Service Updates**:

- [ ] `domainsAPIService.ts` - Add `verifyDns(domainId)` method

### Shared Types

```typescript
// Platform subdomain credits
interface PlatformSubdomainCredits {
  limit: number; // From tier_limits
  used: number; // Count of user's platform subdomains
  remaining: number; // limit - used
}

// Domain with website info
interface DomainWithWebsite {
  id: number;
  domain: string;
  is_platform_subdomain: boolean;
  website_id: number | null;
  website_name: string | null;
  website_urls: Array<{ id: number; path: string; website_id: number }>;
  dns_verification_status: "pending" | "verified" | "failed" | null;
  created_at: string;
}

// AI recommendation
interface DomainRecommendation {
  domain: string;
  subdomain: string;
  path: string;
  fullUrl: string;
  score: number;
  reasoning: string;
  source: "existing" | "generated";
  existingDomainId: number | null;
  availability: "existing" | "available" | "unknown";
}

// Recommendation state
type RecommendationState =
  | "no_existing_sites"
  | "existing_recommended"
  | "new_recommended"
  | "out_of_credits_no_match";
```

---

## Testing Plan

### Unit Tests

- Domain model validation (subdomain format, restrictions)
- WebsiteUrl model validation (single-level paths)
- DNS verification service (mock DNS lookups)
- Credit calculation (limit - used = remaining)

### API Tests

- Domain search with all status values
- Path search on existing domain
- DNS verification endpoint responses
- Context endpoint includes all required fields

### E2E Tests (Playwright)

- First-time user flow: See suggestions → select → deploy
- Existing site flow: See starred existing → select → deploy
- Out of credits flow: See upgrade CTA → can't create new
- Custom domain flow: Enter domain → see instructions → verify → deploy
- Path conflict: Select domain → enter taken path → see error

### Edge Cases

- User at exact credit limit (can't create more)
- DNS propagation delays (30+ minute wait)
- Race condition: Two users claim same subdomain simultaneously
- Plan upgrade mid-flow (credits should update)
- Domain reassignment between projects

---

## Open Questions for Product

1. **DNS check frequency in background**: How often to re-check unverified domains outside of active sessions? (Suggested: Every 5 min for first hour, then every 30 min for 48 hours, then stop)

2. **Subdomain credit increase on upgrade**: If user on Starter (1 credit) upgrades to Growth (2 credits), do they immediately get the additional credit?

3. **Domain deletion**: Can users delete/release a subdomain to free up a credit? What happens to deployed content?

4. **Custom domain verification timeout**: After how long do we stop checking DNS and mark as failed? (Suggested: 48 hours)
