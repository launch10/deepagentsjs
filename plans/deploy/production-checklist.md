# Production Deployment Checklist — Launch10

**Status**: Planning
**Created**: 2026-02-17
**Branch**: `infra-and-logging` (core AWS infrastructure)

## Context

Launch10 needs to go live across three services: **Rails app** (AWS ECS), **Langgraph app** (AWS ECS), and **Landing Page** (Vercel + Cloudflare). The `infra-and-logging` branch has the core AWS infrastructure (Terraform, Dockerfiles, CI/CD, logging/monitoring), but there are significant gaps in secrets, third-party service setup, and the landing page's Cloudflare integration that need to be addressed before we can flip the switch.

This checklist covers **everything** — infrastructure already built (for verification), plus all the external service setup, secrets provisioning, DNS, billing, and go-live verification that's still needed.

---

## A. THIRD-PARTY SERVICE ACCOUNTS & BILLING

### A1. LLM Providers — Production API Keys & Billing

- [ ] **Anthropic**: Set up production workspace, add payment method, set usage limits/alerts
  - Get production API key → will go in Secrets Manager (`launch10/langgraph/anthropic`)
  - Enable automated billing (credit card on file)
  - Set monthly spend alerts ($100, $500, $1000 thresholds)
  - Consider prepaid credits for discount

- [ ] **OpenAI**: Set up production organization, add payment method
  - Get production API key → Secrets Manager (`launch10/langgraph/openai`)
  - Set usage limits (hard + soft caps)
  - Set monthly budget alerts

- [ ] **Groq**: Set up production account, add billing
  - Get API key → Secrets Manager (`launch10/langgraph/groq`)

- [ ] **Google AI (Gemini)**: Set up billing on Google Cloud project
  - Get API key → Secrets Manager (`launch10/langgraph/google`)

- [ ] **LangSmith**: Ensure paid plan for production tracing volume
  - Get production API key → Secrets Manager (`launch10/langgraph/langsmith`)
  - Set project name: `launch10-production`

### A2. Stripe — Production Setup

- [ ] **Switch from test to live mode** in Stripe dashboard
- [ ] Get **live** Publishable Key and Secret Key
  - Store in Rails production credentials (`stripe.publishable_key`, `stripe.secret_key`)
- [ ] **Recreate all products/plans** in live mode (Stripe plans don't transfer from test)
  - Mirror plan IDs from `config/jumpstart.yml`
  - Include free plan with `fake_processor_id` pattern
- [ ] **Set up webhook endpoint**: `https://launch10.ai/webhooks/stripe`
  - Events: `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`
  - Copy webhook signing secret → Rails credentials (`stripe.webhook_signing_secret`)
- [ ] **Enable Stripe Tax** if applicable
- [ ] **Connect bank account** for payouts

### A3. Google Ads — Production Setup

Developer token already approved for Standard access.

- [ ] **Set up production MCC account** (or use existing `764-900-5037` if that's prod)
  - Store in Rails credentials (`google_ads.account_id`)
- [ ] **Create production OAuth credentials** (Google Cloud Console)
  - OAuth client ID + secret → Rails credentials (`google_ads.client_id`, `google_ads.client_secret`)
  - Set authorized redirect URIs for `https://launch10.ai`
- [ ] **Generate refresh token** for server-to-server access
  - Store in Rails credentials (`google_ads.refresh_token`)
- [ ] **Store developer token** → Rails credentials (`google_ads.developer_token`)
- [ ] **Configure conversion tracking** for production

### A4. Error Tracking — Rollbar

- [ ] Create production project in Rollbar
- [ ] Get `post_server_item` access token
  - Store in Rails credentials (`rollbar.access_token`)
  - Also goes in Secrets Manager (`launch10/shared/rollbar`) for Langgraph
- [ ] Set up alert rules (email, Slack integration)
- [ ] Configure rate limits and data retention

### A5. APM — New Relic

- [ ] Sign up for New Relic free tier (100GB/mo ingest, 1 full user)
- [ ] Get license key → Secrets Manager (`launch10/shared/newrelic`)
- [ ] Both services already configured:
  - Rails: `config/newrelic.yml` (uses `newrelic_rpm` gem)
  - Langgraph: `newrelic.js` (uses `newrelic` npm)
- [ ] Set up alert policies (error rate, response time, throughput)

### A6. Email — Resend

- [ ] Create production Resend account (or verify existing)
- [ ] Verify sending domain: `launch10.ai` (DNS records: SPF, DKIM, DMARC)
- [ ] Get production API key → Rails credentials (`resend.api_key`)
- [ ] Configure SMTP: `smtp.resend.com:465` (already in `production.rb`)
- [ ] Set up DMARC policy for `launch10.ai`

### A7. Analytics — PostHog

- [ ] Verify PostHog project exists for production
- [ ] Get API key → Rails credentials (`posthog.api_key`) or `POSTHOG_API_KEY` env var
- [ ] Set `POSTHOG_HOST` (default: `https://us.i.posthog.com`)
- [ ] Landing page already proxies through Vercel (`/ingest/*` → PostHog)

### A8. Support Integrations

- [ ] **Slack**: Create incoming webhook for support tickets
  - Set `SUPPORT_SLACK_WEBHOOK_URL` env var in ECS
- [ ] **Notion**: Create production support database
  - Get integration token → `SUPPORT_NOTION_SECRET` env var
  - Get database ID → `SUPPORT_NOTION_DATABASE_ID` env var
  - Properties: Reference, Subject, Description, Category, Email, Status, Subscription, Credits, Submitted, Source URL, User ID, Attachments

### A9. Cloudflare — Account Setup

- [ ] Verify Cloudflare manages DNS for: `launch10.ai`, `launch10.site`, `launch10.com`
- [ ] Create API token with scopes: Zone DNS, R2, Workers, Firewall
- [ ] Ensure R2 buckets exist:
  - `deploys` (website build artifacts)
  - `uploads` (user uploads — prod bucket)
- [ ] Get R2 access credentials (S3-compatible endpoint, access key, secret key)
- [ ] Create/verify KV namespace for Atlas (DEPLOYS_KV)
- [ ] Store all in Rails credentials or env vars:
  - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_EMAIL`, `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
  - `CLOUDFLARE_DEPLOY_ENV=production`
  - `CLOUDFLARE_BLOCKED_DOMAINS_LIST_ID` (firewall list)

### A10. Uptime Monitoring

- [ ] Sign up for UptimeRobot (free)
- [ ] Add monitors:
  - `https://launch10.ai/up` (Rails health)
  - `https://api.launch10.ai/health` (Langgraph health)
- [ ] Set 5-minute check intervals
- [ ] Configure alert contacts (email + Slack)

---

## B. AWS INFRASTRUCTURE (Terraform)

The `infra-and-logging` branch has complete Terraform IaC. Execute in order:

### B1. Prerequisites

- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Terraform >= 1.5 installed
- [ ] Install new gems locally: `cd rails_app && bundle install` (adds `newrelic_rpm`, `lograge`)

### B2. Terraform State

- [ ] Create S3 bucket for state:
  ```bash
  aws s3api create-bucket --bucket launch10-terraform-state --region us-east-1
  aws s3api put-bucket-versioning \
    --bucket launch10-terraform-state \
    --versioning-configuration Status=Enabled
  ```

### B3. Cloudflare Origin CA Certificate

- [ ] Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate
- [ ] RSA, hostnames: `launch10.ai`, `*.launch10.ai`
- [ ] Save private key and certificate PEM

### B4. Terraform Variables

- [ ] `cd terraform && cp terraform.tfvars.example terraform.tfvars`
- [ ] Fill in Cloudflare certificate PEM values
- [ ] Review instance sizes (defaults are cost-optimized for launch)

### B5. Apply Terraform

- [ ] `terraform init`
- [ ] `terraform plan` — review everything
- [ ] `terraform apply`
- [ ] This creates: VPC, ALB, ECS cluster (5 services), RDS PostgreSQL 17, ElastiCache Redis 7.1, 2 ECR repos, Secrets Manager entries, CloudWatch log groups, Cloud Map namespace

### B6. Populate Secrets Manager

After `terraform apply`, fill in the actual values:

```bash
# Rails master key (decrypts production.yml.enc)
aws secretsmanager put-secret-value \
  --secret-id launch10/rails/master-key \
  --secret-string "$(cat rails_app/config/credentials/production.key)"

# JWT secret (shared between Rails and Langgraph)
aws secretsmanager put-secret-value \
  --secret-id launch10/shared/jwt-secret \
  --secret-string "<generate-a-strong-secret>"

# LLM API keys (from section A1)
aws secretsmanager put-secret-value --secret-id launch10/langgraph/anthropic --secret-string "sk-ant-..."
aws secretsmanager put-secret-value --secret-id launch10/langgraph/openai --secret-string "sk-..."
aws secretsmanager put-secret-value --secret-id launch10/langgraph/groq --secret-string "gsk_..."
aws secretsmanager put-secret-value --secret-id launch10/langgraph/google --secret-string "..."
aws secretsmanager put-secret-value --secret-id launch10/langgraph/langsmith --secret-string "lsv2_..."

# Monitoring (from sections A4, A5)
aws secretsmanager put-secret-value --secret-id launch10/shared/rollbar --secret-string "..."
aws secretsmanager put-secret-value --secret-id launch10/shared/newrelic --secret-string "..."
```

Note: Database password and `DATABASE_URL` are auto-generated by Terraform.

---

## C. MISSING ECS ENVIRONMENT VARIABLES

The Terraform ECS config covers core vars (DB, Redis, LLM keys, JWT, monitoring) but is **missing** several Rails env vars that are needed. These either need to be added to `terraform/ecs.tf` or handled via Rails encrypted credentials (which the `RAILS_MASTER_KEY` already unlocks).

### C1. Vars handled by Rails credentials (no ECS change needed)

These are read via `Rails.application.credentials.dig(...)` and decrypted by `RAILS_MASTER_KEY`:
- Stripe keys (`stripe.publishable_key`, `stripe.secret_key`, `stripe.webhook_signing_secret`)
- Google Ads credentials (`google_ads.*`)
- Resend API key (`resend.api_key`)
- Rollbar token for Rails (`rollbar.access_token`)
- PostHog API key (`posthog.api_key`)
- Google OAuth credentials
- Atlas API secret (`atlas.api_secret`)

**Action**: Ensure `rails_app/config/credentials/production.yml.enc` contains ALL of these values:
- [ ] Edit production credentials: `EDITOR=vim rails credentials:edit --environment production`
- [ ] Add/verify every key listed above

### C2. Vars that MUST be added to ECS task definitions

These are read from `ENV[]` directly and need to be in the Terraform ECS config:

- [ ] Add to Rails services in `terraform/ecs.tf`:
  ```
  API_BASE_URL=https://launch10.ai
  CLOUDFLARE_R2_ENDPOINT=<r2-endpoint>
  CLOUDFLARE_R2_ACCESS_KEY_ID=<r2-key>
  CLOUDFLARE_R2_SECRET_ACCESS_KEY=<r2-secret>  (as a secret)
  CLOUDFLARE_R2_REGION=auto
  CLOUDFLARE_DEPLOY_ENV=production
  CLOUDFLARE_ACCOUNT_ID=<account-id>
  CLOUDFLARE_API_TOKEN=<api-token>  (as a secret)
  CLOUDFLARE_BLOCKED_DOMAINS_LIST_ID=<list-id>
  ATLAS_BASE_URL=https://atlas-admin.launch10.ai
  GOOGLE_ADS_MANAGER_ID=<mcc-id>
  SUPPORT_SLACK_WEBHOOK_URL=<webhook-url>
  SUPPORT_NOTION_SECRET=<token>  (as a secret)
  SUPPORT_NOTION_DATABASE_ID=<db-id>
  POSTHOG_HOST=https://us.i.posthog.com
  CLOUDFLARE_ASSET_HOST=https://uploads.launch10.ai
  ALLOW_ATLAS_SYNC=true
  ```

- [ ] Add to Langgraph services in `terraform/ecs.tf`:
  ```
  ALLOWED_HOSTS=https://launch10.ai
  ```

- [ ] Create corresponding Secrets Manager entries for sensitive values (R2 secret, CF API token, Notion secret)

---

## D. RAILS PRODUCTION CREDENTIALS

- [ ] Edit: `EDITOR=vim rails credentials:edit --environment production`
- [ ] Ensure these keys exist:

```yaml
stripe:
  publishable_key: pk_live_...
  secret_key: sk_live_...
  webhook_signing_secret: whsec_...

google_ads:
  client_id: <oauth-client-id>
  client_secret: <oauth-client-secret>
  refresh_token: <refresh-token>
  developer_token: <developer-token>
  account_id: "<mcc-account-id>"

resend:
  api_key: re_...

rollbar:
  access_token: <post_server_item-token>

posthog:
  api_key: phc_...

atlas:
  api_secret: <hmac-secret>

google:
  client_id: <google-oauth-client-id>
  client_secret: <google-oauth-client-secret>
```

- [ ] Store `production.key` securely (1Password/vault) AND in Secrets Manager

---

## E. DNS & SSL

### E1. Cloudflare DNS Records

Get ALB DNS name after Terraform: `terraform output alb_dns_name`

| Record | Type | Value | Proxy | Purpose |
|--------|------|-------|-------|---------|
| `launch10.ai` | CNAME | `<alb-dns>.elb.amazonaws.com` | Proxied | Rails app |
| `api.launch10.ai` | CNAME | same ALB | Proxied | Langgraph API |
| `cname.launch10.ai` | CNAME | same ALB or Workers route | Proxied | Custom domain target (users CNAME here) |
| `uploads.launch10.ai` | CNAME | R2 custom domain | Proxied | User file uploads CDN |
| `atlas-admin.launch10.ai` | Worker route (wrangler) | — | — | Atlas admin API |
| `*.launch10.site` | Worker route (wrangler) | — | — | User site subdomains |

### E2. SSL — What's Automatic vs Manual

**Automatic (no action needed):**
- `*.launch10.site` — Cloudflare issues wildcard SSL automatically for Worker routes
- Custom user domains (e.g., `mybiz.com`) — Users CNAME to `cname.launch10.ai`, Cloudflare handles SSL via SNI routing
- `launch10.ai` and subdomains — Covered by Cloudflare Universal SSL when proxied

**Manual setup needed:**
- [ ] SSL mode: **Full (Strict)** for `launch10.ai` zone (we have Origin CA cert on ALB)
- [ ] Generate Origin CA certificate for `launch10.ai` + `*.launch10.ai` (section B3)
- [ ] Install Origin CA cert on ALB (handled by Terraform)

### E3. Cloudflare Cache Rules

- [ ] Create rule: hostname = `api.launch10.ai` → **bypass cache** (prevent caching SSE)

### E4. Cloudflare Transform Rules

- [ ] Create rule: hostname = `api.launch10.ai` → set header `X-Accel-Buffering: no` (SSE unbuffering)

### E5. Email DNS (Resend)

- [ ] Add SPF record for `launch10.ai`
- [ ] Add DKIM records (from Resend dashboard)
- [ ] Add DMARC record: `_dmarc.launch10.ai` → `v=DMARC1; p=quarantine; ...`

---

## F. CI/CD PIPELINE (CircleCI)

### F1. IAM User for CI

- [ ] Create IAM user `launch10-ci` with ECR + ECS permissions (script in `docs/deployment/production.md`)
- [ ] Save access key ID and secret

### F2. CircleCI Environment Variables

| Variable | Value |
|----------|-------|
| `AWS_ACCESS_KEY_ID` | From IAM user |
| `AWS_SECRET_ACCESS_KEY` | From IAM user |
| `AWS_DEFAULT_REGION` | `us-east-1` |
| `AWS_ACCOUNT_ID` | 12-digit account ID |

### F3. Verify Pipeline

- [ ] The `.circleci/config.yml` runs:
  - Tests in parallel: `langgraph-tests`, `rails-tests`, `rails-frontend-tests`, `atlas-tests`, `playwright-tests`
  - `deploy-production` after all tests pass (main branch only)
  - Builds both Docker images, pushes to ECR, rolling ECS deploy

---

## G. ATLAS (CLOUDFLARE WORKERS) — User Site Deployment

### G1. Deploy Workers

- [ ] Deploy public worker: `cd atlas && npx wrangler deploy -c wrangler-public.toml`
- [ ] Deploy admin worker: `cd atlas && npx wrangler deploy -c wrangler-admin.toml`
- [ ] Verify routes:
  - `*.launch10.site/*` → public worker
  - `atlas-admin.launch10.ai/*` → admin worker

### G2. Verify KV + R2

- [ ] KV namespace `DEPLOYS_KV` exists and is bound
- [ ] R2 bucket `deploys` exists and is bound
- [ ] HMAC secret matches between Atlas worker and Rails credentials (`atlas.api_secret`)

---

## H. LANDING PAGE (Vercel)

**Recommendation: Keep on Vercel.** It's already configured with prerendering, PostHog proxy, security headers, and SPA rewrites.

### H1. Vercel Deployment

- [ ] Connect `landing_page/` to Vercel project (if not already)
- [ ] Set production domain (e.g., `launch10.com` or `www.launch10.ai`)
- [ ] Configure Vercel environment variables:
  - PostHog API key (if not hardcoded in source)
  - App URL for CTAs (e.g., `VITE_APP_URL=https://launch10.ai`)
- [ ] Verify build command: `vite build && node scripts/prerender.js`

### H2. DNS for Landing Page

- [ ] Point landing page domain to Vercel (Vercel provides DNS instructions)
- [ ] If using `launch10.com`: add Vercel DNS records in Cloudflare for that zone
- [ ] If using `www.launch10.ai`: add CNAME to Vercel in Cloudflare `launch10.ai` zone

### H3. Verify Integration

- [ ] Pricing page CTAs link to `https://launch10.ai/pricing` or `https://launch10.ai/register`
- [ ] PostHog analytics proxy works (`/ingest/*` → `us.i.posthog.com`)
- [ ] Security headers present (X-Frame-Options, HSTS, etc. — configured in `vercel.json`)

---

## I. INITIAL DEPLOY

### I1. First Docker Build + Push (manual, one-time)

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com

# Build + push Rails
docker build \
  --build-arg VITE_LANGGRAPH_API_URL=https://api.launch10.ai \
  -f rails_app/Dockerfile \
  -t ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/launch10-rails:latest \
  rails_app/

docker push ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/launch10-rails:latest

# Build + push Langgraph (context is project root)
docker build \
  -f langgraph_app/Dockerfile \
  -t ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/launch10-langgraph:latest \
  .

docker push ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/launch10-langgraph:latest

# Force deploy all 5 services
for service in rails-web rails-worker rails-scheduler langgraph-web langgraph-worker; do
  aws ecs update-service --cluster launch10 --service $service --force-new-deployment
done

# Wait for stable
aws ecs wait services-stable \
  --cluster launch10 \
  --services rails-web rails-worker rails-scheduler langgraph-web langgraph-worker
```

### I2. Enable pgvector

```bash
TASK_ID=$(aws ecs list-tasks --cluster launch10 --service-name rails-web --query 'taskArns[0]' --output text)
aws ecs execute-command --cluster launch10 --task $TASK_ID --container rails-web --interactive \
  --command "bundle exec rails dbconsole"
# Then: CREATE EXTENSION IF NOT EXISTS vector;
```

### I3. Seed Production Data

`db:prepare` auto-runs via docker-entrypoint on first boot (runs migrations). But you need to seed reference data separately.

**Production-essential seed data:**

- [ ] **Plan Tiers** (`PlanTier`): starter, growth, pro — seeded by `Core::PlanTiers`
- [ ] **Plans** (`Plan`): 6 plans (starter/growth/pro x monthly/annual) — seeded by `Core::Plans`
  - **Important**: Update Stripe price IDs to live mode IDs before seeding
- [ ] **Tier Limits** (`TierLimit`): requests_per_month + platform_subdomains per tier — `Core::TierLimits`
- [ ] **Credit Packs** (`CreditPack`): small/medium/big — `Core::CreditPacks`
  - **Important**: Update Stripe price IDs to live mode IDs before seeding
- [ ] **Templates** (`Template` + `TemplateFile`): Loaded dynamically from `rails_app/templates/` directory
- [ ] **Themes** (`Theme`): Loaded from `db/seeds/themes.sql`
- [ ] **FAQs** (`FAQ`): Loaded from `db/seeds/faqs.sql`
- [ ] **Geo Target Constants** (`GeoTargetConstant`): Loaded from `db/seeds/geo_target_constants.sql`
- [ ] **Model Configs & Preferences**: LLM selection defaults — `Core::ModelConfigs`, `Core::ModelPreferences`
- [ ] **Friends & Family Plan** (optional): $0 hidden plan for early testers — `Core::FriendsFamilyPlan`

**DO NOT seed in production:**
- `BasicAccount` (creates test users with fake subscriptions)
- Test user accounts

**Recommended approach:**
1. Create a `db/seeds/production.rb` that runs only `CoreData` builder (not `BasicAccount`)
2. Or exec into Rails container and run: `CoreData.new.build` + `Core::GeoTargetConstants.new.seed`
3. Create admin user manually via Rails console

---

## J. VERIFICATION CHECKLIST

### J1. Infrastructure Health

- [ ] All 5 ECS services show `ACTIVE` with `runningCount=1`

### J2. Endpoints

- [ ] `curl https://launch10.ai/up` → 200
- [ ] `curl https://api.launch10.ai/health` → `{"status":"ok"}`
- [ ] Landing page loads at production URL

### J3. End-to-End Flows

- [ ] **Signup**: Create account, verify email arrives (Resend)
- [ ] **Billing**: Subscribe to a plan (Stripe live mode), verify webhook fires
- [ ] **Brainstorm**: Start a brainstorm chat, verify SSE streaming works
- [ ] **Website generation**: Generate a landing page, verify it deploys to `*.launch10.site`
- [ ] **Custom domain**: Add a custom domain, verify DNS verification works
- [ ] **Google Ads**: Connect Google Ads account
- [ ] **Support**: Submit a support ticket, verify Slack + Notion notifications

### J4. Monitoring

- [ ] CloudWatch logs: structured JSON appearing in `/ecs/launch10-*` groups
- [ ] New Relic: APM data for both services
- [ ] Rollbar: Trigger test error, verify it appears
- [ ] LangSmith: LLM traces appear
- [ ] UptimeRobot: Both monitors show "Up"
- [ ] PostHog: Events flowing

### J5. Security

- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] HSTS headers present
- [ ] No secrets exposed in logs
- [ ] RDS not publicly accessible

---

## K. POST-LAUNCH

### K1. Immediate (Day 1-2)

- [ ] Monitor error rates in Rollbar
- [ ] Monitor costs in AWS Cost Explorer
- [ ] Monitor LLM spend across all providers

### K2. First Week

- [ ] Set up AWS billing alerts ($50, $100, $200)
- [ ] Set up LLM spend alerts on each provider
- [ ] Review New Relic for slow transactions
- [ ] Test disaster recovery: can you exec into containers, access DB, check logs?
- [ ] Verify backup: RDS automated backups (7-day retention configured)

### K3. Scaling Triggers

| Trigger | Action |
|---------|--------|
| >50 concurrent users | Scale `rails-web` + `langgraph-web` to 2 tasks |
| Sustained high CPU | Add ECS auto-scaling (CPU target tracking) |
| DB bottleneck | Upgrade RDS to `db.t4g.small` |
| Cost optimization (after stable) | Buy 1-year Savings Plan (~40% off) |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `terraform/` | All AWS infrastructure (IaC) |
| `terraform/secrets.tf` | Secrets Manager entries |
| `terraform/ecs.tf` | ECS task definitions with env vars |
| `rails_app/Dockerfile` | Rails production image |
| `langgraph_app/Dockerfile` | Langgraph production image |
| `.circleci/config.yml` | CI/CD pipeline |
| `rails_app/config/credentials/production.yml.enc` | Rails encrypted credentials |
| `rails_app/config/environments/production.rb` | Rails production config |
| `rails_app/config/newrelic.yml` | Rails APM |
| `langgraph_app/newrelic.js` | Langgraph APM |
| `rails_app/config/initializers/logging.rb` | Structured JSON logging |
| `atlas/wrangler-public.toml` | Cloudflare public worker |
| `atlas/wrangler-admin.toml` | Cloudflare admin worker |
| `landing_page/vercel.json` | Landing page deployment |
| `docs/deployment/production.md` | Detailed setup guide (on infra-and-logging branch) |
