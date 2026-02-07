# Authentication

Launch10 uses Devise for user authentication in Rails and JWT tokens for cross-service auth. A single JWT secret is shared between Rails, Langgraph, and Atlas. Multi-tenancy is enforced via `account_id` scoping at every layer.

## Auth Flow

```
┌─────────┐      ┌─────────────┐      ┌────────────┐
│ Browser  │──1──→│    Rails    │      │  Langgraph │
│          │←─2──│ (Devise)    │      │            │
│          │      │             │      │            │
│          │──3──→│             │      │            │
│          │←─4──│ JWT cookie  │      │            │
│          │      └─────────────┘      │            │
│          │                           │            │
│          │──5── Authorization: ──────→│            │
│          │      Bearer <jwt>         │            │
│          │←─6── SSE stream ─────────│            │
└─────────┘                           └────────────┘
```

1. User submits login form to Rails
2. Devise authenticates (email + password, with optional 2FA)
3. On successful login, Rails generates JWT
4. JWT stored in httpOnly cookie (`secure: true` in production, `same_site: :lax`)
5. Frontend sends JWT to Langgraph in `Authorization: Bearer` header
6. Langgraph validates JWT and streams AI responses

## JWT Token Structure

```ruby
{
  jti: user.jwt_payload["jti"],   # JWT ID (for revocation via JTIMatcher)
  sub: user.id,                    # Subject = User ID
  account_id: account.id,          # Multi-tenant scope
  exp: 24.hours.from_now.to_i,    # 24-hour expiry
  iat: Time.current.to_i           # Issued-at timestamp
}
```

- **Algorithm**: HS256
- **Secret**: `Rails.application.credentials.devise_jwt_secret_key!` (shared as `JWT_SECRET` env var in Langgraph)
- **Storage**: httpOnly cookie named `jwt`
- **Refresh**: Automatically refreshed on every HTML page navigation via `before_action :refresh_jwt`

## Multi-Tenancy

```
Account (tenant root)
├── AccountUser (join table, roles: admin/member)
│   └── User
├── Projects
│   ├── Website → CodeFiles, Deploys, Domains
│   ├── Brainstorm
│   └── Campaigns → AdGroups → Ads
└── Chats (thread_id links to Langgraph state)
```

- **ActsAsTenant gem**: All tenant-scoped models use `acts_as_tenant :account` for automatic query scoping
- **Current context**: `Current.account` set on every request via `SetCurrentRequestDetails` concern
- **Account resolution order**: domain → subdomain → `?account_id` param → JWT claim → session → fallback to user's first personal account

## Langgraph JWT Validation

Langgraph validates the JWT in Hono middleware (`authMiddleware`):

1. Extracts token from `Authorization: Bearer <token>` header
2. Verifies signature and expiry using `jsonwebtoken` library
3. Sets `auth.accountId` and `auth.jwt` on the Hono context
4. Downstream graph nodes use `auth.jwt` to make authenticated callbacks to Rails

## Thread/Resource Scoping

When Langgraph receives a request with a `threadId`:

1. Calls Rails `GET /api/v1/chats/validate?thread_id=<id>`
2. Rails checks: does this Chat exist? Does it belong to `current_account`?
3. Returns 403 if chat doesn't exist or belongs to a different account
4. Langgraph only proceeds if validation passes

## Service-to-Service Auth

Internal calls between services (not user-initiated) use HMAC-SHA256 signatures instead of JWT:

- **Header**: `X-Signature: HMAC-SHA256(body, JWT_SECRET)`
- **Rails side**: `verify_internal_service_call` + `skip_before_action :require_api_authentication`
- **Langgraph side**: Timing-safe signature comparison in webhook handlers

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/config/initializers/devise.rb` | Devise config (timeout: 1 day, JTIMatcher revocation) |
| `rails_app/app/models/user.rb` | User model with `jti` column for token revocation |
| `rails_app/app/controllers/concerns/jwt_helpers.rb` | JWT generation, refresh, expiry detection |
| `rails_app/app/controllers/concerns/set_current_request_details.rb` | Account resolution and `Current` context setup |
| `rails_app/app/models/current.rb` | `Current.user`, `Current.account`, `Current.account_admin?` |
| `rails_app/app/models/account.rb` | Tenant root with `owner_id` |
| `rails_app/app/models/account_user.rb` | Join table with roles (admin/member) |
| `rails_app/app/controllers/api/v1/chats_controller.rb` | Thread ownership validation for Langgraph |
| `langgraph_app/app/server/middleware/auth.ts` | JWT validation middleware (Hono) |
| `langgraph_app/app/server/middleware/threadValidation.ts` | Thread ownership check via Rails callback |

## Gotchas

- **JWT refresh is HTML-only**: The `refresh_jwt` before_action only runs on HTML requests. API-only flows don't auto-refresh — the frontend must handle 401s by triggering a page navigation to get a fresh token.
- **`sub` vs `account_id`**: The JWT `sub` field contains the **user ID**, not the account ID. Langgraph historically reads `sub` as `accountId` — use the explicit `account_id` claim instead.
- **JTI revocation**: Changing a user's `jti` (e.g., on password change) invalidates all existing tokens immediately. This is by design via Devise's `JTIMatcher` strategy.
- **Test mode**: In development/test, a special `X-Test-Mode` + `X-Test-Proof` header pair bypasses normal auth for E2E testing. The proof must be a JWT-signed timestamp less than 1 minute old.
