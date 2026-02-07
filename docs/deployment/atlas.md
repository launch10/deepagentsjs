# Atlas (Cloudflare)

Atlas is the edge deployment layer — two Cloudflare Workers that serve user websites and manage deployment configuration. The **public worker** serves sites from R2 storage at `*.launch10.site`. The **admin worker** provides an internal API for Rails to sync accounts, websites, domains, and plans to KV storage.

## Architecture

```
User browser
     │
     │  https://mybiz.launch10.site
     ▼
┌──────────────────────┐
│  Public Worker        │
│  (landing-page-server)│
│                       │
│  1. Resolve hostname  │──→ KV: WebsiteUrl lookup
│  2. Find website      │──→ KV: Website record
│  3. Serve files       │──→ R2: {env}/{website.id}/live/{path}
│  4. SPA fallback      │──→ R2: .../live/index.html
└──────────────────────┘

Rails backend
     │
     │  POST /api/internal/websites
     │  X-Signature: HMAC(body, secret)
     ▼
┌──────────────────────┐
│  Admin Worker         │
│  (landing-page-server │
│   -admin)             │
│                       │
│  CRUD: accounts,      │──→ KV: model storage
│  websites, domains,   │       with auto-indexing
│  plans, website-urls  │
└──────────────────────┘
```

## R2 File Organization

```
{environment}/{website.id}/{target}/{file-path}

Examples:
  production/ws-123/live/index.html
  production/ws-123/live/assets/app-abc123.js
  production/ws-123/preview/index.html
  staging/ws-456/live/index.html
```

- **`live/`**: Production content, served by default
- **`preview/`**: Served when hostname starts with `preview.` (e.g., `preview.mybiz.launch10.site`)
- **Environment**: `production`, `staging`, or `development` (query param `?cloudEnv=staging`)

## KV Data Model

All configuration is stored in Cloudflare KV with the pattern `{env}:{prefix}:{id}` and auto-generated indexes:

| Model | Indexes | Purpose |
|-------|---------|---------|
| Account | planId | Account metadata |
| Website | accountId | Website configuration |
| WebsiteUrl | websiteId, domainPath | Path-based routing (domain + path → website) |
| Domain | websiteId, domain | Legacy domain mapping |
| Plan | — | Billing plan with usage limits |
| Request | accountId | Request counting for rate limits |

## Public Worker Request Flow

1. Parse hostname from incoming request
2. Look up `WebsiteUrl` by domain + path (longest path match for multi-site domains)
3. Fall back to `Domain` lookup (legacy support)
4. Construct R2 key: `{cloudEnv}/{website.id}/{targetDir}/{pathname}`
5. If path has no extension (SPA route like `/pricing`): serve `index.html`
6. Serve file with proper Content-Type and ETag caching

## Admin API

All endpoints at `/api/internal/{resource}`, authenticated via HMAC-SHA256 (`X-Timestamp` + `X-Signature`). 5-minute replay window.

| Resource | Endpoints |
|----------|-----------|
| accounts | CRUD + block/unblock/reset/status |
| websites | CRUD + find-by-url |
| website-urls | CRUD + find-by-domain-path |
| domains | CRUD + find-by-url (legacy) |
| plans | CRUD |

## Rails Integration

Rails syncs data to Atlas via service classes in `rails_app/app/services/atlas/`:

- `Atlas.configure` sets base URL, API secret, and sync toggle (`ALLOW_ATLAS_SYNC`)
- Model concerns (`Atlas::Syncable`) trigger syncs on save/update
- `Atlas::SyncWorker` handles async sync via Sidekiq
- All requests signed with HMAC-SHA256 using shared `ATLAS_API_SECRET`

## Key Files Index

| File | Purpose |
|------|---------|
| `atlas/src/index-public.tsx` | Public worker — serves user sites from R2 |
| `atlas/src/index-admin.tsx` | Admin worker — internal API |
| `atlas/src/models/base.ts` | Generic KV model with auto-indexing (249 lines) |
| `atlas/src/models/website-url.ts` | Path-based routing model (longest match) |
| `atlas/src/sdk/client.ts` | SDKClient for all model operations (320 lines) |
| `atlas/src/middleware/auth/admin/hmac.ts` | HMAC-SHA256 request verification |
| `atlas/src/utils/cloudflare/r2.ts` | R2 storage utility |
| `atlas/src/utils/cloudflare/kv.ts` | KV storage utility |
| `atlas/wrangler-public.toml` | Public worker config (routes: `*.launch10.site/*`) |
| `atlas/wrangler-admin.toml` | Admin worker config (routes: `atlas-admin.launch10.ai/*`) |
| `rails_app/app/services/atlas/base_service.rb` | Rails HTTP client with HMAC signing |
| `rails_app/config/initializers/atlas.rb` | Atlas configuration (base URL, secret, sync toggle) |

## Gotchas

- **SPA fallback logic**: Requests without file extensions serve `index.html`. But dotfile paths (`/.well-known`), asset requests (`.js`, `.css`), and API routes are served as-is.
- **Legacy domain support**: The public worker tries `WebsiteUrl` lookup first (path-based), then falls back to `Domain` (legacy 1:1 mapping). Both paths coexist.
- **IP allowlist disabled**: The admin worker's IP allowlist middleware exists but is currently commented out. Auth relies solely on HMAC signatures.
- **Atlas sync toggle**: `ALLOW_ATLAS_SYNC` defaults to `false` in dev/test. Set to `true` to enable syncing during development.
- **Preview mode**: Adding `preview.` prefix to hostname serves from the `preview/` R2 directory instead of `live/`.
