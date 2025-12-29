# Syncing Langgraph Types from Rails

## When to Use

After any Rails migration that changes the database schema, you must sync Langgraph's Drizzle types.

## The Rule

**Rails owns the schema. Langgraph reflects it.**

```
Rails migration → PostgreSQL schema changes → pnpm run db:reflect → Drizzle types updated
```

## Commands

### After Rails migration

```bash
# 1. In rails_app, run migration
cd rails_app
bundle exec rails db:migrate

# 2. In langgraph_app, sync types
cd ../langgraph_app
pnpm run db:reflect
```

### What db:reflect does

1. Connects to PostgreSQL
2. Reads current schema
3. Generates `langgraph_app/db/schema.ts`
4. TypeScript types now match database

## When to Run

Run `pnpm run db:reflect` after:
- Running any Rails migration
- Pulling changes that include migrations
- Setting up a new development environment

## Verify Types Are Correct

```bash
cd langgraph_app
pnpm run typecheck
```

If typecheck passes, your types are in sync.

## Common Issues

### "Column X doesn't exist" errors

The schema.ts is out of date. Run:
```bash
pnpm run db:reflect
```

### Migration hasn't run yet

```bash
cd rails_app
bundle exec rails db:migrate
cd ../langgraph_app
pnpm run db:reflect
```

## Why This Pattern?

- Single source of truth for schema (Rails)
- No migration conflicts between services
- Langgraph always adapts to current schema
- See `docs/decisions/schema-ownership.md` for full rationale
