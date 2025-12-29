# Data: Decision History

> Decisions about database schema, migrations, and data ownership. Most recent first.

---

## Current State

Rails is the single source of truth for database schema. Langgraph uses Drizzle with `db:reflect` to sync types from the actual PostgreSQL schema. No migration conflicts possible.

```
Rails Migrations → PostgreSQL → pnpm run db:reflect → Drizzle schema.ts
```

---

## Decision Log

### 2025-12-28: Rails Owns the Database Schema

**Context:** Both Rails and Langgraph need to access the same PostgreSQL database. Who controls the schema? Who runs migrations?

**Decision:** Rails is the single source of truth for database schema. Langgraph uses Drizzle in read-only mode with `db:reflect` to sync types.

**Why:**

Prevents migration conflicts:
- If both services ran migrations: race conditions, conflicting changes, version tracking nightmare, risk of data loss
- With Rails as owner: one migration history, one deployment runs migrations, Langgraph just reads current state

Simpler deployment:
```bash
# Rails deployment
bundle exec rails db:migrate  # Changes schema

# Langgraph deployment
pnpm run db:reflect  # Sync types from current schema
```

Conceptually correct:
- Langgraph processes data but doesn't define structure
- It reads projects, websites, brainstorm outputs
- It writes files, updates status, creates checkpoints
- It doesn't decide what a "project" is - Rails does

**Trade-offs:**
- Langgraph can't add its own tables (must go through Rails)
- Schema changes require coordination between teams
- Langgraph devs must remember to run `db:reflect`

**Status:** Current

---

## Files Involved

- `rails_app/db/migrate/` - All migrations live here
- `rails_app/db/schema.rb` - Current schema (generated)
- `langgraph_app/db/schema.ts` - Drizzle schema (generated from Postgres)
- `pnpm run db:reflect` - Sync command
