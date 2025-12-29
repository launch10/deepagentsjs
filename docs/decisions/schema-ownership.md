# Why Rails Owns the Database Schema

## The Problem

Both Rails and Langgraph need to access the same PostgreSQL database. Who controls the schema? Who runs migrations?

## The Decision

**Rails is the single source of truth for database schema.** Langgraph uses Drizzle in read-only mode with `db:reflect` to sync types.

## How It Works

```
┌─────────────────────────────────────────────────┐
│                   Rails App                      │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  ActiveRecord Migrations                   │ │
│  │  - Create tables                           │ │
│  │  - Add columns                             │ │
│  │  - Add indexes                             │ │
│  │  - All schema changes                      │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   PostgreSQL    │
              │   (Schema)      │
              └────────┬────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│                 Langgraph App                    │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  pnpm run db:reflect                       │ │
│  │  - Reads current schema from Postgres      │ │
│  │  - Generates Drizzle schema.ts             │ │
│  │  - TypeScript types match database         │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Why Single Source of Truth

### Prevents Migration Conflicts

If both services ran migrations:
- Race conditions on who runs first
- Conflicting changes to same tables
- Version tracking nightmare
- Risk of data loss

With Rails as owner:
- One migration history
- One deployment runs migrations
- Langgraph just reads current state

### Simpler Deployment

```bash
# Rails deployment
bundle exec rails db:migrate  # Changes schema
# Done

# Langgraph deployment
pnpm run db:reflect  # Sync types from current schema
# Done
```

No coordination needed. Langgraph adapts to whatever schema exists.

### Langgraph is a Stateless Worker

Conceptually, Langgraph processes data but doesn't define structure:
- It reads projects, websites, brainstorm outputs
- It writes files, updates status, creates checkpoints
- It doesn't decide what a "project" is - Rails does

This matches the architecture: Rails is the web app, Langgraph is the AI engine.

## Drizzle Reflect Workflow

When the schema changes:

1. Rails developer creates migration: `rails g migration AddFooToBar`
2. Rails developer runs: `bundle exec rails db:migrate`
3. Langgraph developer runs: `pnpm run db:reflect`
4. Drizzle generates updated `schema.ts`
5. TypeScript now has correct types

## Consequences

**Benefits:**
- Single source of truth for schema
- No migration conflicts between services
- Clear ownership and responsibility
- Langgraph types always match reality

**Trade-offs:**
- Langgraph can't add its own tables (must go through Rails)
- Schema changes require coordination between teams
- Langgraph devs must remember to run `db:reflect`

## Files Involved

- `rails_app/db/migrate/` - All migrations live here
- `rails_app/db/schema.rb` - Current schema (generated)
- `langgraph_app/db/schema.ts` - Drizzle schema (generated from Postgres)
- `pnpm run db:reflect` - Sync command
