# Production Deployment Checklist — Launch10

**Status**: In Progress
**Updated**: 2026-03-02
**Branches**: `production-infra-ops` (Terraform/Docker/CI), `atlas-origin-fallback` (origin proxy)

Legend: `[x]` = done, `[ ]` = todo, `[~]` = partially done, `[C]` = code done (needs deploy/config)

---

## A. THIRD-PARTY SERVICE ACCOUNTS & BILLING

### A1. LLM Providers — Production API Keys & Billing

- [ ] **Anthropic**: Set up production workspace, add payment method, set usage limits/alerts
  - Get production API key → Secrets Manager (`launch10/langgraph/anthropic`)
  - Enable automated billing (credit card on file)
  - Set monthly spend alerts ($100, $500, $1000 thresholds)
- [ ] **OpenAI**: Set up production organization, add payment method
  - Get production API key → Secrets Manager (`launch10/langgraph/openai`)
  - Set usage limits (hard + soft caps)
- [ ] **Groq**: Set up production account, add billing
  - Get API key → Secrets Manager (`launch10/langgraph/groq`)
- [ ] **Google AI (Gemini)**: Set up billing on Google Cloud project
  - Get API key → Secrets Manager (`launch10/langgraph/google`)
- [ ] **LangSmith**: Ensure paid plan for production tracing volume
  - Get production API key → Secrets Manager (`launch10/langgraph/langsmith`)
  - Set project name: `launch10-production`

### A2. Stripe — Production Setup                                  <<<< YOU ARE HERE

- [x] **Switch from test to live mode** in Stripe dashboard
- [~] Get **live** Publishable Key and Secret Key
  - [ ] Store in Rails production credentials (`stripe.publishable_key`, `stripe.secret_key`)
- [ ] **Recreate all products/plans** in live mode (Stripe plans don't transfer from test)
  - Mirror plan IDs from `config/jumpstart.yml`
  - Include free plan with `fake_processor_id` pattern
- [ ] **Set up webhook endpoint**: `https://launch10.com/webhooks/stripe`
  - Events: `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`
  - Copy webhook signing secret → Rails credentials (`stripe.webhook_signing_secret`)
- [ ] **Enable Stripe Tax** if applicable
- [ ] **Connect bank account** for payouts

### A3. Google Ads — Production Setup

Developer token already approved for Standard access.

- [ ] **Set up production MCC account** (or use existing `764-900-5037` if that's prod)
  - Store in Rails credentials (`google_ads.account_id`)
- [ ] **Create production OAuth credentials** (Google Cloud Console)
  - OAuth client ID + secret → Rails credentials
  - Set authorized redirect URIs for `https://launch10.com`
- [ ] **Generate refresh token** for server-to-server access
- [ ] **Store developer token** → Rails credentials
- [ ] **Configure conversion tracking** for production

### A4. Error Tracking — Rollbar

- [ ] Create production project in Rollbar
- [ ] Get `post_server_item` access token → Rails credentials + Secrets Manager
- [ ] Set up alert rules (email, Slack integration)

### A5. APM — New Relic

- [ ] Sign up for New Relic free tier (100GB/mo ingest, 1 full user)
- [ ] Get license key → Secrets Manager (`launch10/shared/newrelic`)
- [C] Both services already configured in code:
  - Rails: `config/newrelic.yml` (uses `newrelic_rpm` gem)
  - Langgraph: `newrelic.js` (uses `newrelic` npm)
- [ ] Set up alert policies (error rate, response time, throughput)

### A6. Email — Resend

- [ ] Create production Resend account (or verify existing)
- [ ] Verify sending domain: `launch10.com` (DNS records: SPF, DKIM, DMARC)
- [ ] Get production API key → Rails credentials (`resend.api_key`)
- [C] SMTP config already in `production.rb`: `smtp.resend.com:465`

### A7. Analytics — PostHog

- [ ] Verify PostHog project exists for production
- [ ] Get API key → Rails credentials (`posthog.api_key`) or `POSTHOG_API_KEY` env var
- [ ] Set `POSTHOG_HOST` (default: `https://us.i.posthog.com`)

### A8. Support Integrations

- [ ] **Slack**: Create incoming webhook for support tickets → `SUPPORT_SLACK_WEBHOOK_URL`
- [ ] **Notion**: Create production support database → `SUPPORT_NOTION_SECRET`, `SUPPORT_NOTION_DATABASE_ID`

### A9. Cloudflare — Account Setup

- [x] Cloudflare manages DNS for `launch10.site` (Workers already deployed)
- [ ] Verify Cloudflare manages DNS for `launch10.com`
- [ ] Create API token with scopes: Zone DNS, R2, Workers, Firewall
- [x] R2 bucket `deploys` exists and bound to Atlas Workers
- [ ] R2 bucket `uploads` exists (user uploads — prod bucket)
- [ ] Get R2 access credentials (S3-compatible endpoint, access key, secret key)
- [x] KV namespace `DEPLOYS_KV` exists and bound
- [ ] Store Cloudflare credentials in Rails credentials/env vars

### A10. Uptime Monitoring

- [ ] Sign up for UptimeRobot (free)
- [ ] Add monitors: `https://launch10.com/up`, `https://api.launch10.com/health`
- [ ] Configure alert contacts (email + Slack)

---

## B. AWS INFRASTRUCTURE (Terraform)

### B1. Prerequisites

- [x] AWS account created
- [x] AWS CLI installed and configured (`aws configure`)
- [ ] Terraform >= 1.5 installed
- [C] New gems already in Gemfile (`newrelic_rpm`, `lograge`)

### B2. Terraform State                                            <<<< YOU ARE HERE

- [x] S3 bucket `launch10-terraform-state` created
- [ ] Enable versioning on the bucket:
  ```bash
  aws s3api put-bucket-versioning \
    --bucket launch10-terraform-state \
    --versioning-configuration Status=Enabled
  ```

### B3. Cloudflare Origin CA Certificate

- [ ] Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate
- [ ] RSA, hostnames: `launch10.com`, `*.launch10.com`
- [ ] Save private key and certificate PEM

### B4. Terraform Variables

- [ ] `cd terraform && cp terraform.tfvars.example terraform.tfvars`
- [ ] Fill in Cloudflare certificate PEM values
- [ ] Review instance sizes (defaults are cost-optimized for launch)

### B5. Apply Terraform

- [ ] `terraform init`
- [ ] `terraform plan` — review everything
- [ ] `terraform apply`
- [ ] Creates: VPC, ALB, ECS cluster (5 services), RDS PostgreSQL 17, ElastiCache Redis 7.1, 2 ECR repos, Secrets Manager entries, CloudWatch log groups, Cloud Map namespace
- [C] All `.tf` files written and committed

### B6. Populate Secrets Manager

After `terraform apply`, fill in actual values:

- [ ] Rails master key: `launch10/rails/master-key`
- [ ] JWT secret: `launch10/shared/jwt-secret`
- [ ] Anthropic: `launch10/langgraph/anthropic`
- [ ] OpenAI: `launch10/langgraph/openai`
- [ ] Groq: `launch10/langgraph/groq`
- [ ] Google: `launch10/langgraph/google`
- [ ] LangSmith: `launch10/langgraph/langsmith`
- [ ] Rollbar: `launch10/shared/rollbar`
- [ ] New Relic: `launch10/shared/newrelic`

---

## C. ECS ENVIRONMENT VARIABLES

### C1. Vars handled by Rails credentials (no ECS change needed)

- [ ] Verify `production.yml.enc` contains ALL of:
  - Stripe keys, Google Ads creds, Resend API key, Rollbar token,
    PostHog API key, Google OAuth creds, Atlas API secret
- [ ] `EDITOR=vim rails credentials:edit --environment production`

### C2. Vars that MUST be added to ECS task definitions

- [ ] Add to Rails services in `terraform/ecs.tf`:
  - `API_BASE_URL`, `CLOUDFLARE_R2_*`, `CLOUDFLARE_DEPLOY_ENV`,
    `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `ATLAS_BASE_URL`,
    `GOOGLE_ADS_MANAGER_ID`, `SUPPORT_*`, `POSTHOG_HOST`,
    `CLOUDFLARE_ASSET_HOST`, `ALLOW_ATLAS_SYNC`
- [ ] Add to Langgraph services: `ALLOWED_HOSTS=https://launch10.com`
- [ ] Create Secrets Manager entries for sensitive values (R2 secret, CF API token, Notion secret)

---

## D. RAILS PRODUCTION CREDENTIALS

- [ ] Edit: `EDITOR=vim rails credentials:edit --environment production`
- [ ] Ensure ALL keys exist (stripe, google_ads, resend, rollbar, posthog, atlas, google)
- [ ] Store `production.key` securely (1Password/vault) AND in Secrets Manager

---

## E. DNS & SSL

### E1. Cloudflare DNS Records (after Terraform → get ALB DNS name)

- [ ] `launch10.com` → CNAME → ALB (Proxied) — Rails app
- [ ] `api.launch10.com` → CNAME → ALB (Proxied) — Langgraph API
- [ ] `cname.launch10.com` → CNAME → ALB (Proxied) — Custom domain target
- [ ] `uploads.launch10.com` → CNAME → R2 custom domain (Proxied)
- [C] `atlas-admin.launch10.com` → Worker route (wrangler)
- [C] `*.launch10.site` → Worker route (wrangler)

### E2. SSL

- [ ] SSL mode: **Full (Strict)** for `launch10.com` zone
- [ ] Origin CA certificate installed on ALB (handled by Terraform after B3)

### E3. Cloudflare Cache Rules

- [ ] hostname = `api.launch10.com` → **bypass cache** (prevent caching SSE)

### E4. Cloudflare Transform Rules

- [ ] hostname = `api.launch10.com` → set header `X-Accel-Buffering: no` (SSE)

### E5. Email DNS (Resend)

- [ ] SPF record for `launch10.com`
- [ ] DKIM records (from Resend dashboard)
- [ ] DMARC record: `_dmarc.launch10.com`

---

## F. CI/CD PIPELINE (CircleCI)

### F1. IAM User for CI

- [ ] Create IAM user `launch10-ci` with ECR + ECS permissions
- [ ] Save access key ID and secret

### F2. CircleCI Environment Variables

- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `AWS_DEFAULT_REGION` = `us-east-1`
- [ ] `AWS_ACCOUNT_ID`

### F3. Verify Pipeline

- [C] `.circleci/config.yml` has deploy-production job (tests → build → push → rolling deploy)

---

## G. ATLAS (CLOUDFLARE WORKERS)

- [C] Public worker code ready (including origin fallback — `atlas-origin-fallback` branch)
- [C] Admin worker code ready
- [x] Workers deployed for `*.launch10.site`
- [x] KV namespace `DEPLOYS_KV` bound
- [x] R2 bucket `deploys` bound
- [ ] HMAC secret matches between Atlas worker and Rails credentials (`atlas.api_secret`)
- [ ] Deploy updated public worker with origin fallback (after merge)

---

## H. LANDING PAGE

- [ ] Connect `landing_page/` to Vercel (or Atlas — origin fallback now supports this)
- [ ] Set production domain
- [ ] Configure environment variables (PostHog, app URL)
- [ ] Verify build: `vite build && node scripts/prerender.js`
- [ ] DNS records pointing to Vercel or Atlas

---

## I. INITIAL DEPLOY

### I1. First Docker Build + Push

- [C] `bin/build` and `bin/push` scripts ready
- [C] Both Dockerfiles ready (Rails + Langgraph)
- [ ] ECR login + build + push (manual first time)
- [ ] Force deploy all 5 ECS services
- [ ] Wait for services stable

### I2. Enable pgvector

- [ ] `CREATE EXTENSION IF NOT EXISTS vector;` via `bin/rails-console`

### I3. Seed Production Data

- [C] `db/seeds/production.rb` exists
- [ ] Update Stripe price IDs to live mode IDs before seeding
- [ ] Run seeds: Plan Tiers, Plans, Tier Limits, Credit Packs, Templates, Themes, FAQs, Geo Targets, Model Configs, Friends & Family Plan
- [ ] Create admin user manually via Rails console

---

## J. VERIFICATION

### J1. Infrastructure Health

- [ ] All 5 ECS services `ACTIVE` with `runningCount=1`

### J2. Endpoints

- [ ] `curl https://launch10.com/up` → 200
- [ ] `curl https://api.launch10.com/health` → `{"status":"ok"}`
- [ ] Landing page loads

### J3. End-to-End Flows

- [ ] Signup + email (Resend)
- [ ] Subscribe to plan (Stripe live)
- [ ] Brainstorm chat (SSE streaming)
- [ ] Generate landing page → deploys to `*.launch10.site`
- [ ] Custom domain + DNS verification
- [ ] Google Ads connect
- [ ] Support ticket → Slack + Notion

### J4. Monitoring

- [ ] CloudWatch logs flowing
- [ ] New Relic APM data
- [ ] Rollbar test error
- [ ] LangSmith traces
- [ ] UptimeRobot monitors up
- [ ] PostHog events

### J5. Security

- [ ] HTTPS enforced
- [ ] HSTS headers
- [ ] No secrets in logs
- [ ] RDS not publicly accessible

---

## K. POST-LAUNCH

### K1. Day 1-2

- [ ] Monitor error rates
- [ ] Monitor AWS costs
- [ ] Monitor LLM spend

### K2. First Week

- [ ] AWS billing alerts ($50, $100, $200)
- [ ] LLM spend alerts per provider
- [ ] Review New Relic for slow transactions
- [ ] Test disaster recovery (exec into containers, access DB, check logs)
- [ ] Verify RDS automated backups (7-day retention)

---

## Progress Summary

```
Section                          Done    Total   Status
─────────────────────────────────────────────────────────
A. Third-Party Services          3       ~30     10%  ██░░░░░░░░
B. AWS Infrastructure            3       ~12     25%  ███░░░░░░░
C. ECS Env Vars                  0       ~5      0%   ░░░░░░░░░░
D. Rails Credentials             0       ~3      0%   ░░░░░░░░░░
E. DNS & SSL                     0       ~10     0%   ░░░░░░░░░░
F. CI/CD                         0       ~5      0%   ░░░░░░░░░░
G. Atlas Workers                 4       ~6      67%  ███████░░░
H. Landing Page                  0       ~5      0%   ░░░░░░░░░░
I. Initial Deploy                0       ~6      0%   ░░░░░░░░░░
J. Verification                  0       ~15     0%   ░░░░░░░░░░
K. Post-Launch                   0       ~7      0%   ░░░░░░░░░░
─────────────────────────────────────────────────────────
CODE COMPLETE (just needs deploy)        ~15     [C] markers above
```

**You are at: A2 (Stripe done) + B2 (Terraform state bucket exists)**

**Next critical path:** B3 → B4 → B5 (Terraform apply) → then everything else unblocks.
