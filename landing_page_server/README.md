```txt
npm install
npm run dev
```

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```

## Uploading A Landing Page (Locally)

```bash
./upload-dist-to-r2.sh path/to/landing/page/dist user-pages/dist
```

## Testing A Deployed Page (Locally)

```bash
pnpm wrangler dev --local --persist-to .wrangler/state
```

## Basic Setup

```bash
pnpm cli set site --id 1 --url localhost:8787 -t 1
pnpm cli set site --id 2 --url localhost:9898 -t 2
pnpm cli set tenant --id 1 --org-id 1 --plan-id 1
pnpm cli set tenant --id 2 --org-id 2 --plan-id 2
pnpm cli set plan --id 1 --name "Starter Plan" --limit 1_000_000
pnpm cli set plan --id 2 --name "Pro Plan" --limit 5_000_000
pnpm cli set plan --id 3 --name "Enterprise Plan" --limit 20_000_000
```

## CLI

### Commands:

- set tenant - Set tenant data with ID, org ID, and plan ID
- set site - Set site data with URL, tenant ID, live/preview deploy SHAs
- set plan - Set plan data with name and usage limit
- get - Retrieve data by ID or other indexes
- delete - Delete records (with --force flag)
- list - List all records or filter by criteria

Usage Examples

# Set a tenant

pnpm run cli set tenant -i tenant123 -o org456 -p plan-pro

# Set a site

pnpm run cli set site -i site789 -u https://example.com -t tenant123 -l ABC123 -p DEF456

# Set a plan

pnpm run cli set plan -i plan-pro -n "Pro Plan" -l 5000000

# Get data

pnpm run cli get tenant tenant123
pnpm run cli get site --by-url https://example.com
pnpm run cli get site --by-tenant tenant123

# List data

pnpm run cli list tenants
pnpm run cli list sites --tenant tenant123

# Delete data

pnpm run cli delete tenant tenant123 --force

The CLI uses Miniflare for local KV access and includes type validation from your existing
models. You can run pnpm run cli --help to see all available commands.
