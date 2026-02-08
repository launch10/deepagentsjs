# Shared Database

Rails and Langgraph share a single PostgreSQL database. Rails owns the schema and runs all migrations via ActiveRecord. Langgraph reads and writes using Drizzle ORM with types introspected from the live database. This "Rails-owns-schema" pattern ensures a single source of truth while giving Langgraph type-safe access.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              PostgreSQL Database                 │
│        (launch{N}_development / _test)           │
└──────────┬──────────────────────────┬───────────┘
           │                          │
  ┌────────▼─────────┐     ┌─────────▼──────────┐
  │   Rails 8        │     │  Langgraph (Hono)  │
  │   ActiveRecord   │     │  Drizzle ORM       │
  │   Owns schema    │     │  Read/write access  │
  │   Runs migrations│     │  Types via reflect  │
  └──────────────────┘     └────────────────────┘

Schema Sync:
  Rails migration → PostgreSQL → pnpm run db:reflect → schema.ts
```

## Database Names

Auto-detected from directory name via `config/services.sh`:

| Instance | Dev Database | Test Database |
|----------|-------------|---------------|
| launch10 | `launch10_development` | `launch10_test` |
| launch3 | `launch3_development` | `launch3_test` |

## Rails Side (Schema Owner)

**Migrations**: `rails_app/db/migrate/*.rb` — Standard ActiveRecord migrations.

```bash
bundle exec rake db:migrate          # Run migrations
bundle exec rake db:migrate:status   # Check status
```

**Configuration**: `rails_app/config/database.yml`
```yaml
development:
  database: <%= db_prefix %>_development
test:
  database: <%= db_prefix %>_test
```

## Langgraph Side (Drizzle ORM)

**Schema sync** (after Rails migrations):
```bash
cd langgraph_app
pnpm run db:reflect
```

This runs `drizzle-kit introspect` which:
1. Connects to the live PostgreSQL database
2. Generates `app/db/schema.ts` with all table definitions
3. Preserves manually-maintained `app/db/relations.ts`

**Two connection libraries**:
- `postgres` (via Drizzle) — Primary query interface
- `pg` (Pool) — Connection pooling, max 20 connections

**Usage**:
```typescript
import { db, websites, websiteFiles, eq } from "@db";

// Read
const [site] = await db.select().from(websites)
  .where(eq(websites.id, websiteId));

// Write
await db.insert(websiteFiles).values({ websiteId, path, content });
await db.update(websites).set({ status }).where(eq(websites.id, id));
```

## Table Ownership

| Tables | Owner | Langgraph Access |
|--------|-------|-----------------|
| `accounts`, `users`, `projects` | Rails | Read only |
| `websites`, `website_files`, `components` | Rails | Read + Write |
| `templates`, `themes` | Rails | Read only |
| `llm_usage`, `llm_conversation_traces` | Rails | Write (billing data) |
| `deploys`, `domains` | Rails | Read + Write |
| `checkpoints`, `checkpoint_writes`, `checkpoint_blobs` | LangGraph | Read + Write (system tables) |

## Relations File

`app/db/relations.ts` is manually maintained (not auto-generated) to preserve business logic:

```typescript
export const websitesRelations = relations(websites, ({ one, many }) => ({
  project: one(projects, {
    fields: [websites.projectId],
    references: [projects.id],
  }),
  websiteFiles: many(websiteFiles),
}));
```

The `pnpm run db:reflect` script backs up `relations.ts` before introspection and restores it afterward.

## Service-to-Service Communication

For operations requiring Rails business logic, Langgraph calls the Rails API:

```typescript
import { createRailsApiClient } from "@shared/api/client";

const client = await createRailsApiClient({ jwt, internalServiceCall: true });
const { data } = await client.GET("/api/v1/websites/{id}", { params: { path: { id } } });
```

Authentication: JWT token + HMAC signature for user requests; HMAC only for internal service calls.

## Introspection Config

```typescript
// drizzle.config.ts
{
  schema: "./app/db/schema.ts",
  dialect: "postgresql",
  introspect: { casing: "camel" },
  tablesFilter: [
    "!checkpoint_migrations",    // LangGraph system
    "!checkpoints",
    "!checkpoint_writes",
    "!domain_request_counts_*",  // Partition tables
    "!account_request_counts_*",
    "!_*", "!pg_*",             // PostgreSQL system
  ],
}
```

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/config/database.yml` | Rails DB connection config |
| `rails_app/db/migrate/*.rb` | Rails migration files (schema owner) |
| `rails_app/db/schema.rb` | Generated schema dump |
| `langgraph_app/drizzle.config.ts` | Drizzle introspection settings |
| `langgraph_app/app/db/schema.ts` | Auto-generated Drizzle schema |
| `langgraph_app/app/db/relations.ts` | Manually-maintained relations |
| `langgraph_app/app/db/client.ts` | Drizzle client initialization |
| `langgraph_app/app/core/postgres.ts` | Connection pool (max 20) |
| `langgraph_app/scripts/db/preserve-relations.ts` | `db:reflect` implementation |
| `docs/decisions/data.md` | Architecture decision record |

## Gotchas

- **Never modify schema from Langgraph**: All schema changes must go through Rails migrations. Langgraph only reads the schema via introspection.
- **Relations are manual**: `app/db/relations.ts` is NOT auto-generated. The `db:reflect` script preserves it, but manual edits are required when new relationships are added.
- **Run `db:reflect` after migrations**: Whenever Rails runs a migration that adds/removes columns or tables, Langgraph's schema.ts must be regenerated.
- **Filtered tables**: Partition tables (`*_request_counts_*`) and LangGraph checkpoint tables are excluded from introspection to keep the schema clean.
- **camelCase convention**: Drizzle uses `camelCase` for TypeScript properties while PostgreSQL uses `snake_case`. The `casing: "camel"` config handles this automatically.
