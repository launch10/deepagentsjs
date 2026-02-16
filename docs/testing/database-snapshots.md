# Database Snapshots

Database snapshots provide fast, repeatable test state for both E2E and integration tests. Snapshots are SQL dump files stored on disk that can be restored in milliseconds, eliminating the need to rebuild test data from scratch. A builder system creates snapshots in dependency order, and both Playwright and Langgraph tests restore them via a Rails API.

## How It Works

```
Snapshot Creation (one-time):
  BaseBuilder restores base snapshot
       │
       ▼
  Builder.build() → FactoryBot + direct SQL
       │
       ▼
  Database::Snapshotter.dump() → .sql file
       │
       ▼
  test/fixtures/database/snapshots/{name}.sql

Snapshot Restoration (per test):
  Test beforeEach
       │
       ▼
  POST /test/database/restore_snapshot { name }
       │
       ├─ Truncate non-heavy tables (CASCADE, RESTART IDENTITY)
       ├─ Ensure analytics partitions exist
       ├─ psql executes .sql file (triggers disabled)
       └─ Clear analytics cache
       │
       ▼
  Database ready with known state (~50ms)
```

## Builder Dependency Chain

```
core_data (plans, templates, themes, FAQs)
  └─ basic_account (subscribed test user + credits)
  │   └─ non_subscribed_account
  │
  └─ brainstorm_step (project at brainstorm)
      └─ website_step (theme, uploads, domains)
          └─ website_generated (scheduling-tool content)
              └─ domain_step (domain + URL)
                  └─ website_deploy_step (completed deploy, workflow → ads)
                      ├─ website_with_import_errors
                      ├─ website_with_broken_links
                      └─ campaign_content_step → highlights → keywords → settings → launch → review → complete
                          └─ deploy_step (Google OAuth, pending deploy)
                              └─ website_deployed (25 test leads)
                                  ├─ campaign_with_metrics (4 projects, 30-day data)
                                  ├─ analytics/healthy_account (3 projects, ~47 leads)
                                  ├─ analytics/struggling_account (0 leads, $320 spent)
                                  ├─ analytics/stalled_project (14+ days no leads)
                                  └─ analytics/new_account (3 days old)
```

## Usage in Tests

**Playwright E2E:**
```typescript
import { DatabaseSnapshotter } from "./fixtures/database";

test.beforeEach(async ({ page }) => {
  await DatabaseSnapshotter.restoreSnapshot("website_step");
  const project = await appQuery<{ id: number; uuid: string }>("first_project");
  await loginUser(page);
});
```

**Langgraph Integration:**
```typescript
import { DatabaseSnapshotter } from "@services/core/railsApi/snapshotter";

beforeEach(async () => {
  await DatabaseSnapshotter.restoreSnapshot("website_generated");
});
```

## Builder System

Builders are Ruby classes in `spec/snapshot_builders/` configured via `builders.yml`:

```ruby
class WebsiteStep < BaseBuilder
  def base_snapshot = "basic_account"
  def output_name = "website_step"

  def build
    # FactoryBot + direct SQL to create test state
  end
end
```

**Rake tasks:**
```bash
RAILS_ENV=test rake db:snapshot:build[basic_account]   # Build one
RAILS_ENV=test rake db:snapshot:build_all              # Build all (topological order)
RAILS_ENV=test rake db:snapshot:deps[campaign_complete] # Show dependency chain
```

## Heavy Table Optimization

Two tables are excluded from truncation/restore for performance:

| Table | Rows | Why Excluded |
|-------|------|-------------|
| `geo_target_constants` | ~228K | Google Ads location data, seeded once in CI |
| `icon_embeddings` | Large | Icon search embeddings, seeded separately |

These persist across snapshot restores. In CI, they're seeded before the test suite starts.

## Rails API Endpoints (Test Only)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/test/database/restore_snapshot` | POST | Restore a snapshot |
| `/test/database/truncate` | POST | Truncate non-heavy tables |
| `/test/database/snapshots` | GET | List available snapshots |
| `/test/database/snapshots` | POST | Create a new snapshot |
| `/test/database/set_credits` | POST | Set account credits for billing tests |

Protected by `Test::TestController` which checks `Rails.env.local?`.

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/services/database/snapshotter.rb` | Core service (dump, restore, truncate) |
| `rails_app/app/controllers/test/database_controller.rb` | Test-only API endpoints |
| `rails_app/test/fixtures/database/snapshots/*.sql` | SQL snapshot files (~30 total) |
| `rails_app/spec/snapshot_builders/builders.yml` | Builder configuration with dependencies |
| `rails_app/spec/snapshot_builders/base_builder.rb` | Base class for all builders |
| `rails_app/e2e/fixtures/database.ts` | Playwright client |
| `shared/lib/api/databaseSnapshotter.ts` | Langgraph client |
| `rails_app/lib/tasks/snapshot_builder.rake` | Build tasks |

## Gotchas

- **Always restore in beforeEach**: Each test must start with known state. Never rely on state from a previous test.
- **Single worker mode**: Playwright runs with `workers: 1` to prevent database race conditions during snapshot restoration.
- **Sequences reset on restore**: `RESTART IDENTITY` prevents duplicate key errors when inserting new records after restore.
- **Never use `puts` in snapshotter**: Use `Rails.logger` to prevent EPIPE errors in Foreman/Overmind.
- **Partition handling**: Snapshot restore ensures analytics partition tables exist before executing SQL, creating them on demand if missing.
- **Builder order matters**: `rake db:snapshot:build_all` uses topological sort based on `builders.yml` dependencies.
