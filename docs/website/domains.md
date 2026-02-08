# Domains

Every deployed website needs a domain. Launch10 supports two types: **platform subdomains** (`*.launch10.site`, auto-verified) and **custom domains** (user-owned, require CNAME verification). Domains are plan-limited, soft-deletable, and auto-synced to Atlas (Cloudflare) for serving.

## How It Works

```
User picks domain in DomainPicker
       │
       ▼
POST /api/v1/domains { domain, website_id, is_platform_subdomain }
       │
       ▼
WebsiteUrl.assign_domain_to_website()
       │
       ├─ Domain exists, owned by user → reuse
       ├─ Domain exists, other account → error
       └─ Domain doesn't exist → create
       │
       ▼
WebsiteUrl created/updated (domain_id + website_id + path)
       │
       ▼
Atlas::Syncable → sync to Cloudflare (domain + website_url)
```

## Domain Types

| Type | Example | Verification | Limit |
|------|---------|-------------|-------|
| Platform subdomain | `mybiz.launch10.site` | Auto-verified | Plan-based (e.g., 3 for Growth) |
| Custom domain | `www.mybiz.com` | CNAME → `cname.launch10.ai` | Unlimited |

## Domain → Website Connection

Each website has exactly one `WebsiteUrl` (enforced by unique constraint):

```
Domain (e.g., "mybiz.launch10.site")
  └─ WebsiteUrl (domain_id + website_id + path)
       └─ full_url = "https://mybiz.launch10.site/landing"
```

- **Paths** are single-level only (e.g., `/landing`, `/services`). No nested paths.
- **Update-in-place** pattern: changing a domain reuses the same WebsiteUrl record to prevent ID churn.

## DNS Verification (Custom Domains)

1. User adds custom domain in DomainPicker
2. UI shows CNAME setup instructions: point domain to `cname.launch10.ai`
3. User clicks "Verify DNS" → `POST /api/v1/domains/:id/verify_dns`
4. `DnsVerificationService` does CNAME lookup via Ruby `Resolv::DNS`
5. Tries domain as-is, then `www.#{domain}`
6. Returns: `verified`, `pending` (wrong CNAME), or `failed` (DNS error)

**Background cleanup**: `ReleaseStaleDomainsWorker` runs daily, hard-deletes custom domains unverified for 7+ days.

## Frontend: DomainPicker

The DomainPicker UI has two input fields:

1. **Site name** — dropdown with modes:
   - "Create New Site" (platform subdomain with `.launch10.site` suffix)
   - "Connect Your Own Domain" (custom domain)
   - Shows existing domains grouped together
   - AI-generated subdomain suggestions from `recommendDomains` graph node

2. **Page name** — path input (e.g., `/landing`)
   - Single-level, lowercase + hyphens only
   - Auto-saves on blur (debounced 750ms)

**ClaimSubdomainModal**: New platform subdomains require confirmation, showing remaining credits. If out of credits, shows upgrade prompt.

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/models/domain.rb` | Domain model (validation, plan limits, DNS status) |
| `rails_app/app/models/website_url.rb` | Domain ↔ Website join (path, uniqueness) |
| `rails_app/app/models/concerns/website_url_concerns/assignment.rb` | `assign_domain_to_website` logic |
| `rails_app/app/models/concerns/domain_concerns/normalize_domain.rb` | Auto-prepends `www.` if no subdomain |
| `rails_app/app/services/domains/dns_verification_service.rb` | CNAME lookup and verification |
| `rails_app/app/controllers/api/v1/domains_controller.rb` | CRUD + search + verify_dns endpoints |
| `rails_app/app/controllers/api/v1/context_controller.rb` | `domain_context` endpoint (all picker data) |
| `rails_app/app/workers/domains/` | Verify DNS, release stale domains workers |
| `rails_app/app/javascript/frontend/components/website/sidebar/domain-picker/` | DomainPicker UI |
| `rails_app/app/javascript/frontend/lib/validation/domain.ts` | Client-side validation (subdomain, domain, path regex) |

## Gotchas

- **Domain normalization**: Bare domains (e.g., `example.com`) get `www.` prepended automatically → `www.example.com`. Domains with existing subdomains (e.g., `shop.example.com`) are kept as-is.
- **Global uniqueness**: Domain names are unique across all accounts. A domain claimed by one account cannot be claimed by another.
- **Soft delete vs hard delete**: Normal deletion is soft (`acts_as_paranoid`). `domain.release!` does a hard delete (`really_destroy!`) — used for stale unverified domains.
- **Platform subdomain credits**: Checked against `account.plan.limit_for("platform_subdomains")`. The limit is plan-tier dependent.
- **Restricted domains**: A hardcoded blocklist prevents claiming system domains like `uploads.launch10.ai`, `staging.launch10.ai`.
