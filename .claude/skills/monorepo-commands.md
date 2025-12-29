# Monorepo Commands

## Development Servers

### Start Everything

```bash
# Rails (from rails_app/)
cd rails_app
bin/dev
# Runs: Rails server, Vite, Sidekiq, Stripe CLI

# Langgraph (from langgraph_app/)
cd langgraph_app
pnpm run dev
```

### Start Individually

```bash
# From root
pnpm run dev:rails      # Just Rails
pnpm run dev:langgraph  # Just Langgraph
```

## Testing

```bash
# All tests
pnpm run test:all

# Individual apps
pnpm run test:rails
pnpm run test:langgraph
```

## Linting

```bash
# All linting
pnpm run lint:all

# Individual apps
pnpm run lint:rails      # Rubocop
pnpm run lint:langgraph  # ESLint + TypeScript
```

## Type Generation

```bash
# Generate TypeScript types from Rails
pnpm run types:generate

# Sync types to shared package
pnpm run types:sync

# Generate Swagger docs from specs
pnpm run docs:generate
```

## Database

```bash
# Rails migrations
cd rails_app
bundle exec rails db:migrate

# Langgraph schema sync
cd langgraph_app
pnpm run db:reflect

# Database seeds
cd rails_app
bundle exec rails db:seed
```

## Scripts Location

All monorepo scripts are in `scripts/`:

| Script | Purpose |
|--------|---------|
| `generate-docs.sh` | Generate Swagger from specs |
| `generate-types.sh` | Generate TypeScript types |
| `prepush.sh` | Pre-push validation |
| `lint-all.sh` | Run all linters |
| `test-all.sh` | Run all tests |

## Git Hooks

Pre-push hook (`./scripts/prepush.sh`) runs automatically before `git push`:
1. Generates Swagger docs
2. Generates TypeScript types
3. Fails if generated files have uncommitted changes

Run manually:
```bash
./scripts/prepush.sh
```
