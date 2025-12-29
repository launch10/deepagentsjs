# Type Generation

## When to Use

When you need to:
- Update TypeScript types after Rails model changes
- Generate API types from request specs
- Keep frontend types in sync with backend

## Quick Reference

| What | Command | Location |
|------|---------|----------|
| Generate all types | `pnpm run types:generate` | Root |
| Sync types to shared | `pnpm run types:sync` | Root |
| Generate Swagger docs | `pnpm run docs:generate` | Root |
| Generate Inertia types | `bundle exec rake inertia:generate` | rails_app |
| Reflect DB schema | `pnpm run db:reflect` | langgraph_app |

## Type Flows

### Inertia Props (Rails → React)

```
Ruby Schema Files (spec/support/schemas/inertia/)
         │
         ▼
   OpenAPI YAML (swagger/v1/inertia-props.yaml)
         │
         ▼
   TypeScript Types (shared/lib/api/generated/inertia-props.ts)
         │
         ▼
   React Components with typed props
```

**Command:**
```bash
cd rails_app
bundle exec rake inertia:generate
```

See `rails_app/.claude/skills/inertia-props-types.md` for full guide.

### Database Schema (Rails → Langgraph)

```
Rails Migrations
         │
         ▼
   PostgreSQL Schema
         │
         ▼
   Drizzle schema.ts (langgraph_app/db/)
```

**Command:**
```bash
cd langgraph_app
pnpm run db:reflect
```

See `sync-langgraph-types.md` skill for details.

### API Types (Rails → Frontend)

```
RSpec Request Specs
         │
         ▼
   Swagger/OpenAPI YAML
         │
         ▼
   TypeScript API Client Types
```

**Commands:**
```bash
# Generate Swagger docs from specs
pnpm run docs:generate

# Generate TypeScript from Swagger
pnpm run types:generate

# Sync to shared package
pnpm run types:sync
```

## Pre-push Checks

The pre-push hook ensures types are up to date:

```bash
./scripts/prepush.sh
```

This runs:
1. `docs:generate` - Swagger docs
2. `types:generate` - TypeScript types
3. Fails if generated files differ from committed

## Common Issues

### TypeScript errors after Rails changes

```bash
# After model changes
pnpm run types:generate
pnpm run types:sync

# After migration
cd langgraph_app && pnpm run db:reflect

# After Inertia prop changes
cd rails_app && bundle exec rake inertia:generate
```

### "Type X doesn't match"

The generated types are out of sync. Regenerate:

```bash
pnpm run types:generate
pnpm run types:sync
```
