# Architecture Overview

Launch10 is a three-service system: a **Rails frontend** for users and data, a **Langgraph backend** for AI agent orchestration, and **Atlas** (Cloudflare Workers) for serving deployed landing pages at the edge. All three share a single JWT secret for authentication. Rails and Langgraph share one PostgreSQL database.

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Browser (React/Inertia)                  │
│                                                               │
│   Inertia pages ──→ Rails (port 3000)                        │
│   Chat/AI calls ──→ Langgraph (port 4000) via SSE streams    │
│   Published sites → Atlas (*.launch10.site)                   │
└───────────┬──────────────────┬────────────────┬──────────────┘
            │                  │                │
            ▼                  ▼                ▼
┌───────────────────┐ ┌────────────────┐ ┌──────────────────┐
│   Rails (Hono)    │ │   Langgraph    │ │   Atlas          │
│                   │ │   (Hono)       │ │   (CF Workers)   │
│ • Devise auth     │ │ • AI graphs    │ │ • Public worker  │
│ • JWT generation  │ │ • LLM calls    │ │ • Admin worker   │
│ • Inertia pages   │ │ • SSE streams  │ │ • R2 storage     │
│ • Sidekiq jobs    │ │ • BullMQ jobs  │ │ • KV config      │
│ • Stripe billing  │ │ • Token track  │ │ • Rate limiting  │
└────────┬──────────┘ └───────┬────────┘ └────────┬─────────┘
         │                    │                    │
         └────────┬───────────┘                    │
                  ▼                                │
         ┌────────────────┐               ┌───────┴────────┐
         │  PostgreSQL    │               │  Cloudflare    │
         │  (shared DB)  │               │  R2 + KV       │
         └────────────────┘               └────────────────┘
                  │
         ┌────────┴────────┐
         │     Redis       │
         │ (Sidekiq + LG   │
         │  prompt cache)  │
         └─────────────────┘
```

## Service Communication

| Direction | Mechanism | Auth | Example |
|-----------|-----------|------|---------|
| Browser → Rails | HTTP (Inertia) | Session cookie + JWT cookie | Page loads, form submissions |
| Browser → Langgraph | HTTP + SSE | `Authorization: Bearer <jwt>` | Chat messages, AI streaming |
| Langgraph → Rails | HTTP POST | HMAC-SHA256 signature (`X-Signature`) | Billing notifications, job results |
| Rails → Langgraph | HTTP POST (webhook) | HMAC-SHA256 signature (`X-Signature`) | Job completion callbacks |
| Rails → Atlas | HTTP | JWT + IP allowlist | Deploy websites, manage domains |
| Atlas → Browser | HTTP | Public (rate-limited) | Serve published landing pages |

## How It Works

1. **User signs in** via Rails (Devise). Rails generates a JWT with `{ sub: user_id, account_id, exp: 24h }` stored in an httpOnly cookie.
2. **Frontend pages** are rendered by Rails via Inertia.js. The JWT is passed to React as an Inertia prop for Langgraph API calls.
3. **AI interactions** (chat, brainstorm, website edits) go directly from the browser to Langgraph with the JWT in the Authorization header. Langgraph validates the token and streams results back via SSE.
4. **Background coordination** uses a fire-and-forget + webhook callback pattern. Langgraph notifies Rails of completed work (billing, code files) via signed HTTP POSTs. Rails notifies Langgraph of completed background jobs via signed webhook callbacks.
5. **Deployments** flow from Langgraph (which orchestrates the build) to Rails (which stores code files and triggers deploys) to Atlas (which serves the final site from R2).

## Key Files Index

### Rails

| File | Purpose |
|------|---------|
| `rails_app/config/routes.rb` | Main routing (Inertia pages + API) |
| `rails_app/config/routes/api.rb` | JWT-authenticated API endpoints |
| `rails_app/app/controllers/concerns/jwt_helpers.rb` | JWT generation and refresh |
| `rails_app/app/controllers/subscribed_controller.rb` | Base controller, shares JWT with frontend |
| `rails_app/app/clients/langgraph_client.rb` | Rails → Langgraph HTTP client |
| `rails_app/app/clients/langgraph_callback_client.rb` | Signed webhook callbacks to Langgraph |

### Langgraph

| File | Purpose |
|------|---------|
| `langgraph_app/server.ts` | Hono server entry point |
| `langgraph_app/app/server/middleware/auth.ts` | JWT validation middleware |
| `langgraph_app/app/server/middleware/composed.ts` | Middleware stack (auth + credit check + CORS) |
| `langgraph_app/app/server/routes/website.ts` | Website graph HTTP + SSE routes |
| `langgraph_app/app/server/routes/webhooks/jobRunCallback.ts` | Webhook receiver for Rails job completions |
| `shared/lib/api/client.ts` | Shared HTTP client with HMAC signing |

### Atlas

| File | Purpose |
|------|---------|
| `atlas/src/index-public.tsx` | Public worker — serves user sites from R2 |
| `atlas/src/index-admin.tsx` | Admin worker — deploy API for Rails |
| `atlas/wrangler-public.toml` | Public worker config (R2, KV bindings) |
| `atlas/wrangler-admin.toml` | Admin worker config (IP allowlist) |

### Infrastructure

| File | Purpose |
|------|---------|
| `config/services.sh` | Port allocation, instance detection |
| `bin/services` | Service manager (dev/test/cleanup) |
| `Procfile.dev` | Development process definitions |

## Gotchas

- **Shared database**: Rails owns the schema (migrations). Langgraph reads via Drizzle ORM with `drizzle-kit pull` to reflect the Rails schema. Never create Drizzle migrations for Rails-owned tables.
- **JWT `sub` field**: Contains the `user_id` on the Rails side, but Langgraph reads it as `accountId` (historical mapping). The `account_id` claim is the reliable account identifier.
- **Port detection**: `config/services.sh` auto-detects the instance from the directory name (`launch1/` → offset +100). All service URLs derive from this.
- **CORS**: Langgraph's allowed origins are computed from `RAILS_PORT` in the environment. Mismatched ports cause silent CORS failures.
