# Deploying to Cloudflare from Rails

## Overview

This skill covers deploying websites and syncing metadata from Rails to Cloudflare (Atlas + R2).

## Important: Synchronous Deploys

When deploying from the console or rake tasks, always use `async: false`:

```ruby
website.deploy(async: false, environment: 'staging')
website.preview(async: false, environment: 'staging')
```

This runs the build and upload synchronously so you can see the results immediately. The `async: true` default is for background job processing in the web app.

## Environment Variables

| Variable                | Purpose                                 | Default                       |
| ----------------------- | --------------------------------------- | ----------------------------- |
| `CLOUDFLARE_DEPLOY_ENV` | R2 path prefix and Atlas KV environment | `Rails.env`                   |
| `ALLOW_ATLAS_SYNC`      | Enable Atlas metadata sync in dev/test  | `false`                       |
| `ATLAS_BASE_URL`        | Atlas admin API URL                     | `http://localhost:8788` (dev) |

## Supported Environments

- `development` - Local development
- `staging` - Pre-production testing
- `production` - Live environment

## Rake Tasks

### Sync metadata to Atlas (staging)

```bash
bin/rails atlas:sync:staging
```

### Sync metadata to Atlas (production)

```bash
bin/rails atlas:sync:production
```

### Deploy a specific website to staging

```bash
bin/rails deploy:website[website_id] CLOUDFLARE_DEPLOY_ENV=staging
```

### Deploy all websites to staging

```bash
bin/rails deploy:all CLOUDFLARE_DEPLOY_ENV=staging
```

### Preview deploy (doesn't go live)

```bash
bin/rails deploy:preview[website_id] CLOUDFLARE_DEPLOY_ENV=staging
```

## Rails Console Usage

### Sync to staging from development

```ruby
# In development, sync metadata to staging Atlas KV
CLOUDFLARE_DEPLOY_ENV=staging ALLOW_ATLAS_SYNC=true bin/rails console

# Then sync a website
website = Website.find(id)
website.sync_to_atlas
```

### Deploy to staging from development

```ruby
CLOUDFLARE_DEPLOY_ENV=staging ALLOW_ATLAS_SYNC=true bin/rails console

# Deploy a website to staging R2 + sync metadata
website = Website.find(id)
website.deploy(async: false, environment: 'staging')
```

## How It Works

1. **R2 Files**: Stored at `{environment}/{website_id}/{target}/{path}`
   - `staging/123/live/index.html`
   - `production/123/preview/styles.css`

2. **Atlas KV**: Keys prefixed with environment
   - `staging:website:123`
   - `production:index:websiteUrl:domainPath:example.com:/`

3. **Environment Flow**:
   - `CLOUDFLARE_DEPLOY_ENV` sets the environment
   - R2 uploads use this as path prefix
   - Atlas API receives `X-Environment` header
   - Atlas stores KV keys with environment prefix

## Viewing Deployed Sites

Access staging deployments via:

```
https://your-domain.com/?cloudEnv=staging
```

The `cloudEnv` query parameter tells the public Atlas worker which environment's files to serve.

## Subpath Deployments

Websites can be deployed to subpaths like `/bingo` on a domain. See `docs/architecture/subpath-deployment.md` for the full explanation.

**Key constraints:**
- Paths must start with `/`
- Only single-level paths supported (e.g., `/bingo`, not `/marketing/campaign`)
- Atlas redirects `/bingo` → `/bingo/` to ensure relative asset paths resolve correctly

```ruby
# Create a WebsiteUrl for subpath deployment
website_url = WebsiteUrl.create!(
  website: website,
  domain: domain,
  path: "/bingo"  # Single-level only
)

# Sync to Atlas and deploy
website.sync_all_to_atlas
website.deploy(async: false, environment: 'staging')
```

Access at: `https://example.launch10.site/bingo/?cloudEnv=staging`
