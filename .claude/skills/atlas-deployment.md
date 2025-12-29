# Atlas Deployment

## What is Atlas?

Atlas is the Cloudflare Workers application that serves user websites. It consists of:
- **Public worker**: Serves deployed websites to end users
- **Admin worker**: Manages metadata in Cloudflare KV

## Development

### Run locally

```bash
cd atlas

# Run both workers
pnpm run dev:all

# Or individually
pnpm run dev:public  # http://localhost:8787
pnpm run dev:admin   # http://localhost:8788
```

## Deployment

### Deploy to production

```bash
cd atlas

# Deploy public worker
pnpm run deploy:public

# Deploy admin worker
pnpm run deploy:admin
```

## How Atlas Works

1. User deploys website from Rails
2. Files uploaded to Cloudflare R2
3. Metadata synced to Cloudflare KV via Admin worker
4. Public worker serves files from R2 based on KV routing

```
Request → Public Worker → KV Lookup → R2 Fetch → Response
```

## Environment-Aware Deployment

Atlas supports multiple environments:

| Environment | R2 Path | KV Prefix |
|-------------|---------|-----------|
| development | `development/...` | `development:...` |
| staging | `staging/...` | `staging:...` |
| production | `production/...` | `production:...` |

Access staging via query param:
```
https://example.launch10.site/?cloudEnv=staging
```

## Syncing from Rails

```bash
cd rails_app

# Sync to staging
bundle exec rake atlas:sync:staging

# Sync to production
bundle exec rake atlas:sync:production
```

See `rails_app/.claude/skills/cloudflare-deploy.md` for deployment details.

## Architecture Details

See `atlas/docs/ROUTING_DEEP_DIVE.md` and `docs/decisions/webcontainers.md` for full architecture.
