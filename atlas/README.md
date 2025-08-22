# Atlas

In mythology, Atlas carrried the world on his shoulders. In our world, Atlas is the system that holds all of our user websites, preventing any one website from taking down the entire system.

It's a Cloudflare edge gateway that serves user-generated static websites with internal API management.

## Admin Server + User Server

### Two Separate Workers

1. **Public Worker** (`src/index-public.tsx`)

   - **Purpose**: Serve user-generated static websites
   - **Access**: Publicly accessible via user-configured domains
   - **Features**: Rate limiting, caching, static file serving

2. **Admin Worker** (`src/index-admin.tsx`)
   - **Purpose**: Internal API for Rails to manage websites/configuration
   - **Access**: Private network only (`admin.nichefinder.com`)
   - **Features**: Full CRUD operations on KV store
   - **Security**: JWT auth, IP allowlisting, network isolation

## Project Structure

```
atlas/
├── src/
│   ├── index-public.tsx      # Public worker entry point
│   ├── index-admin.tsx       # Admin worker entry point
│   ├── api/                  # Internal API (admin worker only)
│   │   ├── index.ts          # API setup with JWT auth
│   │   └── routes/           # CRUD endpoints
│   │       ├── user.ts
│   │       ├── website.ts
│   │       └── plan.ts
│   ├── sdk/                  # Shared SDK for KV operations
│   │   ├── client.ts         # Main SDK client
│   │   └── types.ts          # Shared types
│   ├── cli/                  # CLI tool for local development
│   │   ├── index.ts          # CLI entry point
│   │   └── commands/         # CLI commands
│   └── models/               # Data models
│       ├── base.ts           # Base model with indexing
│       ├── user.ts
│       ├── website.ts
│       └── plan.ts
├── wrangler-public.toml      # Public worker config
├── wrangler-admin.toml       # Admin worker config
└── package.json              # Dependencies and scripts
```

## Interaction With Rails Server

Rails hits the internal admin API to create/update users, websites, plans, and deploy landing pages. The admin API is protected by IP allowlisting and JWT authentication.

## Development

### Prerequiwebsites

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
pnpm cli set user --id 1 --org-id org1 --plan-id starter
pnpm cli get user 1
```

### Basic Local Setup

```bash
# Create test data
pnpm cli set website --id 1 --url localhost:8787 -t 1
pnpm cli set website --id 2 --url localhost:9898 -t 2
pnpm cli set website --id 3 --url c0e82a814b8a.ngrok-free.app -t 1
pnpm cli set user --id 1 --org-id 1 --plan-id 1
pnpm cli set user --id 2 --org-id 2 --plan-id 2
pnpm cli set plan --id 1 --name "starter" --limit 1000000
pnpm cli set plan --id 2 --name "pro" --limit 5000000
pnpm cli set plan --id 3 --name "enterprise" --limit 20000000
```

### Uploading Landing Pages (Local Testing)

```bash
# Upload a built landing page to R2
./upload-dist-to-r2.sh path/to/landing/page/dist user-pages/dist
```

## Production Deployment

### Deploy Both Workers

```bash
# Deploy public-facing worker (serves user websites)
pnpm run deploy:public

# Deploy admin API worker (internal only)
pnpm run deploy:admin
```

### Configuration

#### Public Worker (`wrangler-public.toml`)

- **URL**: User-configured domains
- **Purpose**: Serve all user-generated websites
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
# Create/Update User
HTTParty.post("https://admin-api.internal.nichefinder.com/api/internal/users",
  headers: { 'Authorization' => "Bearer #{jwt_token}" },
  body: { id: "user-1", orgId: "org-1", planId: "starter" }
)

# Create/Update Website
HTTParty.post("https://admin-api.internal.nichefinder.com/api/internal/websites",
  headers: { 'Authorization' => "Bearer #{jwt_token}" },
  body: { id: "website-1", url: "example.com", userId: "user-1" }
)

# Trigger Deploy
HTTParty.post("https://admin-api.internal.nichefinder.com/api/internal/deploy",
  headers: { 'Authorization' => "Bearer #{jwt_token}" },
  body: { websiteId: "website-1", files: [...], config: {...} }
)
```

## CLI

The CLI is for local development and debugging only:

```bash
# Set operations
pnpm cli set user --id 1 --org-id org1 --plan-id starter
pnpm cli set website --id 1 --url example.com --user-id 1
pnpm cli set plan --id starter --name "Starter" --limit 1000000
pnpm cli set website --id 1 --url c0e82a814b8a.ngrok-free.app --user-id 1

# Get operations
pnpm cli get user 1
pnpm cli get website 1
pnpm cli get website --by-url example.com

# List operations
pnpm cli list users
pnpm cli list websites --user 1
pnpm cli list plans

# Delete operations
pnpm cli delete user 1 --force
pnpm cli delete website 1 --force
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
