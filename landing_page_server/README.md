# Landing Page Server

A secure, scalable Cloudflare Workers-based system for serving user-generated static sites with internal API management.

## Admin Server + User Server

### Two Separate Workers

1. **Public Worker** (`src/index-public.tsx`)

   - **Purpose**: Serve user-generated static sites
   - **Access**: Publicly accessible via user-configured domains
   - **Features**: Rate limiting, caching, static file serving

2. **Admin Worker** (`src/index-admin.tsx`)
   - **Purpose**: Internal API for Rails to manage sites/configuration
   - **Access**: Private network only (`admin.nichefinder.com`)
   - **Features**: Full CRUD operations on KV store
   - **Security**: JWT auth, IP allowlisting, network isolation

## Project Structure

```
landing_page_server/
├── src/
│   ├── index-public.tsx      # Public worker entry point
│   ├── index-admin.tsx       # Admin worker entry point
│   ├── api/                  # Internal API (admin worker only)
│   │   ├── index.ts          # API setup with JWT auth
│   │   └── routes/           # CRUD endpoints
│   │       ├── tenant.ts
│   │       ├── site.ts
│   │       └── plan.ts
│   ├── sdk/                  # Shared SDK for KV operations
│   │   ├── client.ts         # Main SDK client
│   │   └── types.ts          # Shared types
│   ├── cli/                  # CLI tool for local development
│   │   ├── index.ts          # CLI entry point
│   │   └── commands/         # CLI commands
│   └── models/               # Data models
│       ├── base.ts           # Base model with indexing
│       ├── tenant.ts
│       ├── site.ts
│       └── plan.ts
├── wrangler-public.toml      # Public worker config
├── wrangler-admin.toml       # Admin worker config
└── package.json              # Dependencies and scripts
```

## Interaction With Rails Server

Rails hits the internal admin API to create/update tenants, sites, plans, and deploy landing pages. The admin API is protected by IP allowlisting and JWT authentication.

## Development

### Prerequisites

```bash
pnpm install
```

### Running Locally

```bash
# Run both workers (admin + public) concurrently
pnpm run dev:all

# Or run individually:
pnpm run dev:public  # Public worker on http://localhost:8787
pnpm run dev:admin   # Admin worker on http://localhost:8788

# Use the CLI for local management
pnpm cli set tenant --id 1 --org-id org1 --plan-id starter
pnpm cli get tenant 1
```

### Basic Local Setup

```bash
# Create test data
pnpm cli set site --id 1 --url localhost:8787 -t 1
pnpm cli set site --id 2 --url localhost:9898 -t 2
pnpm cli set tenant --id 1 --org-id 1 --plan-id 1
pnpm cli set tenant --id 2 --org-id 2 --plan-id 2
pnpm cli set plan --id 1 --name "Starter Plan" --limit 1000000
pnpm cli set plan --id 2 --name "Pro Plan" --limit 5000000
pnpm cli set plan --id 3 --name "Enterprise Plan" --limit 20000000
```

### Uploading Landing Pages (Local Testing)

```bash
# Upload a built landing page to R2
./upload-dist-to-r2.sh path/to/landing/page/dist user-pages/dist
```

## Production Deployment

### Deploy Both Workers

```bash
# Deploy public-facing worker (serves user sites)
pnpm run deploy:public

# Deploy admin API worker (internal only)
pnpm run deploy:admin
```

### Configuration

#### Public Worker (`wrangler-public.toml`)

- **URL**: User-configured domains
- **Purpose**: Serve all user-generated sites
- **Bindings**: DEPLOYS_R2, DEPLOYS_KV, FIREWALL (DO)

#### Admin Worker (`wrangler-admin.toml`)

- **Route**: `admin-api.internal.nichefinder.com/*`
- **Purpose**: Internal API for Rails
- **Bindings**: DEPLOYS_KV, DEPLOYS_R2
- **Security**: Set `ALLOWED_IPS` environment variable

### Network Security

1. **Cloudflare Access**: Set up Zero Trust policies for admin worker
2. **IP Allowlisting**: Configure `ALLOWED_IPS` in production
3. **Private Routing**: Use Cloudflare Tunnel for Rails → Admin Worker
4. **No Public DNS**: Don't create public DNS records for admin API

## API Usage (Rails Integration)

### Authentication

Rails should generate JWT tokens with the same secret:

```ruby
# In Rails
jwt_token = JWT.encode(
  { sub: user_id, exp: 24.hours.from_now.to_i },
  ENV['JWT_SECRET']
)
```

### Example API Calls

```ruby
# Create/Update Tenant
HTTParty.post("https://admin-api.internal.nichefinder.com/api/internal/tenants",
  headers: { 'Authorization' => "Bearer #{jwt_token}" },
  body: { id: "tenant-1", orgId: "org-1", planId: "starter" }
)

# Create/Update Site
HTTParty.post("https://admin-api.internal.nichefinder.com/api/internal/sites",
  headers: { 'Authorization' => "Bearer #{jwt_token}" },
  body: { id: "site-1", url: "example.com", tenantId: "tenant-1" }
)

# Trigger Deploy
HTTParty.post("https://admin-api.internal.nichefinder.com/api/internal/deploy",
  headers: { 'Authorization' => "Bearer #{jwt_token}" },
  body: { siteId: "site-1", files: [...], config: {...} }
)
```

## CLI Tool

The CLI is for local development and debugging only:

```bash
# Set operations
pnpm cli set tenant --id 1 --org-id org1 --plan-id starter
pnpm cli set site --id 1 --url example.com --tenant-id 1
pnpm cli set plan --id starter --name "Starter" --limit 1000000

# Get operations
pnpm cli get tenant 1
pnpm cli get site 1
pnpm cli get site --by-url example.com

# List operations
pnpm cli list tenants
pnpm cli list sites --tenant 1
pnpm cli list plans

# Delete operations
pnpm cli delete tenant 1 --force
pnpm cli delete site 1 --force
```

## Environment Variables

### Development (.dev.vars)

```env
JWT_SECRET=your-development-secret
NODE_ENV=development
LOG_LEVEL=debug
```

### Production (via Wrangler secrets)

```bash
# Set secrets for admin worker
wrangler secret put JWT_SECRET -c wrangler-admin.toml
wrangler secret put ALLOWED_IPS -c wrangler-admin.toml

# Set secrets for public worker (if needed)
wrangler secret put CLOUDFLARE_API_TOKEN -c wrangler-public.toml
```

## Testing

### Test Admin API

```bash
# Start admin worker locally
pnpm run dev:admin

# Run test script
./test-api.sh
```

### Test Public Worker

```bash
# Start public worker locally
pnpm run dev:public

# Visit http://localhost:8787
# Files should be served from R2 DEPLOYS_R2 bucket
```

## Type Generation

For generating/synchronizing types based on your Worker configuration:

```bash
npm run cf-typegen
```

## Monitoring

- **Public Worker**: Monitor via Cloudflare Analytics Dashboard
- **Admin Worker**:
  - Set up alerts for unauthorized access attempts
  - Monitor JWT validation failures
  - Track API usage by Rails

## Security Checklist

- [ ] Admin worker deployed to internal-only route
- [ ] IP allowlist configured for production
- [ ] JWT secret rotated and stored securely
- [ ] Cloudflare Access policies configured
- [ ] No public DNS for admin API domain
- [ ] Rate limiting configured on public worker
- [ ] Monitoring alerts set up
- [ ] Regular security audits scheduled

## Troubleshooting

### "Unsupported platform" Error

This occurs when Miniflare is imported in worker code. Ensure:

- CLI code is separate from worker code
- SDK doesn't import Node.js-only dependencies

### API Returns 403 Forbidden

Check:

- IP allowlist configuration
- JWT token expiration
- Authorization header format

### Public Site Not Loading

Verify:

- R2 bucket binding exists
- Files uploaded to correct path in R2
- Content-Type headers set correctly

## License

Private and confidential.
