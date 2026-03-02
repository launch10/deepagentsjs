# Domain Migration: launch10.com → launch10.com

## Context

Launch10 is preparing for production deployment. The codebase currently references `launch10.com` in ~171 files but the target production domain is `launch10.com`. Some files (terraform variables, jumpstart domain, SMTP config) already use `.com`. There are no production users yet, so all references can be switched directly to `.com` with no backward compatibility needed.

---

## Phase 0: Cloudflare & DNS Prerequisites (Manual, Before Code Deploy)

These must be done in the Cloudflare dashboard before deploying code changes.

### 0a. DNS Records in Cloudflare (launch10.com zone)

After Terraform creates the ALB, get DNS name: `terraform output alb_dns_name`

| Record | Type | Value | Proxy | Purpose |
|--------|------|-------|-------|---------|
| `launch10.com` | CNAME | `<alb-dns>.elb.amazonaws.com` | Proxied | Rails app |
| `api.launch10.com` | CNAME | same ALB | Proxied | Langgraph API |
| `cname.launch10.com` | CNAME | same ALB or Workers route | Proxied | Custom domain CNAME target |
| `uploads.launch10.com` | CNAME | R2 custom domain | Proxied | Production uploads CDN |
| `dev-uploads.launch10.com` | CNAME | R2 custom domain (dev bucket) | Proxied | Dev uploads CDN |
| `atlas-admin.launch10.com` | Worker route (wrangler) | — | — | Atlas admin API |

### 0b. Cloudflare R2 CDN

Configure `uploads.launch10.com` to serve the R2 `uploads` bucket and `dev-uploads.launch10.com` to serve the `dev-uploads` bucket via R2 Custom Domains in the Cloudflare dashboard.

### 0c. SSL Configuration

- SSL mode: **Full (Strict)** for `launch10.com` zone
- Generate Origin CA cert: Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate
  - RSA, hostnames: `launch10.com`, `*.launch10.com`
  - Save PEM values for `terraform.tfvars`

### 0d. Cloudflare Cache & Transform Rules

- Cache rule: hostname = `api.launch10.com` → **bypass cache** (prevents SSE caching)
- Transform rule: hostname = `api.launch10.com` → set header `X-Accel-Buffering: no`

### 0e. Email DNS (Resend)

Add to `launch10.com` zone:
- SPF record for `launch10.com`
- DKIM records (from Resend dashboard after verifying domain)
- DMARC record: `_dmarc.launch10.com` → `v=DMARC1; p=quarantine; ...`

### 0f. Google OAuth redirect URIs

Update authorized redirect URIs in Google Cloud Console to include `https://launch10.com/auth/google_oauth2/callback`

### 0g. Stripe webhook endpoint

Update webhook endpoint in Stripe dashboard: `https://launch10.com/webhooks/stripe`

### 0h. Uptime monitors

Update UptimeRobot monitors to `https://launch10.com/up` and `https://api.launch10.com/health`

---

## Phase 1: Critical Runtime Code

These changes affect production behavior. Deploy together.

### 1a. DNS Verification — use launch10.com CNAME

**File:** `rails_app/app/services/domains/dns_verification_service.rb`
- Change `EXPECTED_CNAME` from `"cname.launch10.com"` to `"cname.launch10.com"`

### 1b. Frontend CNAME constant

**File:** `rails_app/app/javascript/frontend/lib/constants/dnsProviders.tsx:37`
- `"cname.launch10.com"` → `"cname.launch10.com"`

### 1c. Domain model restricted domains

**File:** `rails_app/app/models/domain.rb:32-37`
- Change all `.launch10.com` suffixes to `.launch10.com` in `RESTRICTED_DOMAINS`

### 1d. Langgraph CORS

**File:** `langgraph_app/server.ts:28`
- `["https://launch10.com"]` → `["https://launch10.com"]`

### 1e. Rails production API base URL

**File:** `rails_app/config/environments/production.rb:101`
- `"https://launch10.com"` → `"https://launch10.com"`

### 1f. Atlas initializer

**File:** `rails_app/config/initializers/atlas.rb:8`
- `"https://atlas-admin.launch10.com"` → `"https://atlas-admin.launch10.com"`

### 1g. CarrierWave asset host

**File:** `rails_app/config/initializers/carrierwave.rb`
- Line 19: `"https://dev-uploads.launch10.com"` → `"https://dev-uploads.launch10.com"`
- Line 28: `"https://uploads.launch10.com"` → `"https://uploads.launch10.com"` and `"https://dev-uploads.launch10.com"` → `"https://dev-uploads.launch10.com"`

### 1h. Deploy build env var

**File:** `rails_app/app/models/concerns/website_deploy_concerns/buildable.rb:59`
- `"https://launch10.com"` → `"https://launch10.com"`

### 1i. Brainstorm UI screenshot URL

**File:** `langgraph_app/app/prompts/brainstorm/contextMessages.ts:89`
- `"https://uploads.launch10.com/..."` → `"https://uploads.launch10.com/..."`

### 1j. Atlas admin CORS

**File:** `atlas/src/middleware/auth/admin/cors.ts:13-14`
- Replace `'https://launch10.com'` and `'https://www.launch10.com'` with `'https://launch10.com'` and `'https://www.launch10.com'`

### 1k. Atlas admin wrangler route

**File:** `atlas/wrangler-admin.toml:10`
- `{ pattern = "atlas-admin.launch10.com/*", zone_name = "launch10.com" }` → `{ pattern = "atlas-admin.launch10.com/*", zone_name = "launch10.com" }`

---

## Phase 2: Build & Deploy Pipeline

### 2a. CircleCI Docker build arg

**File:** `.circleci/config.yml:571`
- `https://api.launch10.com` → `https://api.launch10.com`

### 2b. bin/build script

**File:** `bin/build` (line ~23)
- `https://api.launch10.com` → `https://api.launch10.com`

---

## Phase 3: User-Facing Text & Config

### 3a. Auth legal footer

**File:** `rails_app/app/javascript/frontend/components/auth/AuthLegalFooter.tsx:5-7`
- `https://launch10.com/terms` → `https://launch10.com/terms`
- `https://launch10.com/privacy` → `https://launch10.com/privacy`

### 3b. DomainPicker UI text

**File:** `rails_app/app/javascript/frontend/components/website/domain-picker/DomainPicker.tsx:292`
- `launch10.com` → `launch10.com`

### 3c. Jumpstart support email

**File:** `rails_app/config/jumpstart.yml:6`
- `support@launch10.com` → `support@launch10.com`

### 3d. FAQ seed data

**File:** `rails_app/db/seeds/faqs.sql` (9 occurrences)
- `support@launch10.com` → `support@launch10.com`

### 3e. Devise test user email

**File:** `rails_app/config/initializers/devise.rb:70`
- `test_user@launch10.com` → `test_user@launch10.com`

### 3f. JWT helpers test user

**File:** `rails_app/app/controllers/concerns/jwt_helpers.rb:65`
- `test_user@launch10.com` → `test_user@launch10.com`

---

## Phase 4: Environment & Config Files

### 4a. Rails .env (development)

**File:** `rails_app/.env`
- `CLOUDFLARE_ASSET_HOST=https://dev-uploads.launch10.com` → `https://dev-uploads.launch10.com`
- `ATLAS_BASE_URL=https://atlas-admin.launch10.com` → `https://atlas-admin.launch10.com`

### 4b. Rails .env.example

**File:** `rails_app/.env.example`
- Update all `launch10.com` URLs to `launch10.com`

---

## Phase 5: Test Fixtures & Specs (Batch)

### Strategy: targeted find-and-replace

**5a. Email addresses** — `@launch10.com` → `@launch10.com` in:
- `rails_app/spec/snapshot_builders/*.rb`
- `rails_app/e2e/fixtures/*.ts`
- `rails_app/e2e/**/*.spec.ts`
- `rails_app/e2e/app_commands/scenarios/*.rb`
- `rails_app/spec/requests/*.rb`

**5b. Domain references in specs** — `launch10.com` → `launch10.com` in:
- `rails_app/spec/services/domains/dns_verification_service_spec.rb`
- `rails_app/spec/requests/api/v1/domains_spec.rb`
- `rails_app/spec/models/domain_spec.rb`
- `rails_app/spec/services/google_ads/resources/ad_spec.rb`
- `rails_app/spec/integration/prerender_spec.rb`
- `rails_app/spec/integration/tracking_library_spec.rb`
- `rails_app/spec/models/website_deploy_spec.rb`
- `rails_app/spec/workers/domains/*.rb`
- `rails_app/e2e/domain-picker.spec.ts`

**5c. Regenerate database snapshots** after updating builders:
```bash
cd rails_app && bundle exec rake db:snapshots:rebuild
```

---

## Phase 6: Documentation (Batch)

Bulk find-and-replace `launch10.com` → `launch10.com` across:
- `docs/**/*.md`
- `plans/**/*.md`
- `CLAUDE.md`
- `rails_app/plans/**/*.md`
- `langgraph_app/plans/**/*.md`

### DO NOT touch:
- `.har` recording files (Polly.js test recordings)
- `langgraph_app/app/cache/websites/` (cached HTML)
- `shared/websites/examples/` (CDN image URLs — update only after CDN DNS migration)
- Google service account email in `google_docs/sync_service.rb` (`launch10@launch10-479317.iam.gserviceaccount.com` is a GCP IAM identity, not a domain)

---

## Files Already Correct (no changes needed)

| File | Setting |
|------|---------|
| `terraform/variables.tf:96` | `default = "launch10.com"` |
| `rails_app/config/jumpstart.yml:5` | `domain: launch10.com` |
| `rails_app/config/jumpstart.yml:7` | `default_from_email: Launch10 <no-reply@launch10.com>` |
| `rails_app/config/environments/production.rb:97` | `domain: "launch10.com"` (SMTP) |
| `plans/deploy/production-checklist.md` | DNS section already uses `.com` |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Polly.js recordings | Do NOT modify `.har` files |
| Stale database snapshots | Regenerate after updating snapshot builders (Phase 5c) |

---

## Verification

1. **Unit tests**: `cd rails_app && bundle exec rspec` — verify domain specs pass
2. **Langgraph tests**: `cd langgraph_app && pnpm test` — verify no breakage
3. **Grep audit**: `grep -r "launch10\.ai" --include="*.rb" --include="*.ts" --include="*.tsx" --include="*.yml" --include="*.yaml" rails_app/app rails_app/config langgraph_app/app langgraph_app/server.ts .circleci/` — should return zero matches (excluding allowed exceptions)
4. **E2E smoke**: Domain picker should show `cname.launch10.com` as CNAME target
