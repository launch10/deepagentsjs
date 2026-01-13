# Database Snapshots

Database snapshots provide fast, repeatable test state for both unit tests and E2E tests.

## Overview

Snapshots are SQL dumps stored in `test/fixtures/database/snapshots/`. They contain INSERT statements for test data that can be quickly restored between tests.

### Heavy Tables

Some tables contain large amounts of reference data that rarely changes:

- `geo_target_constants` (~228K records) - Google Ads location targeting data. See [geo-target-constants.md](../features/geo-target-constants.md)
- `icon_embeddings` - Icon search embeddings

These "heavy tables" are **excluded from normal truncation** to avoid slow restore times. They're loaded once before tests start and preserved across snapshot restores.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     E2E Test Lifecycle                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CI Setup (once, before Playwright)                          │
│     └── rake db:geo_target_constants:seed                       │
│                                                                 │
│  2. Per-Test (beforeEach)                                       │
│     └── Restore snapshot                                        │
│         ├── Truncate non-heavy tables                           │
│         └── Load snapshot data (users, accounts, projects...)   │
│                                                                 │
│  3. Global Teardown (once)                                      │
│     └── Cleanup uploads                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Rake Tasks

### Snapshot Management

```bash
# Restore a snapshot (development or test)
bundle exec rake db:restore_snapshot[basic_account]

# List available snapshots
RAILS_ENV=test bundle exec rake db:list_snapshots

# Create a new snapshot (test env only)
RAILS_ENV=test bundle exec rake db:snapshot[my_snapshot]
```

### Geo Target Constants

```bash
# Seed geo_target_constants from db/seeds/geo_target_constants.sql
bundle exec rake db:geo_target_constants:seed

# Dump geo_target_constants to test/fixtures/database/snapshots/
bundle exec rake db:geo_target_constants:dump

# Both seed and dump (refresh the snapshot)
bundle exec rake db:geo_target_constants:refresh
```

### Snapshot Builders

```bash
# Build a specific snapshot
RAILS_ENV=test bundle exec rake db:snapshot:build[basic_account]

# Build all snapshots in dependency order
RAILS_ENV=test bundle exec rake db:snapshot:build_all

# List available builders
RAILS_ENV=test bundle exec rake db:snapshot:list

# Show dependency chain
RAILS_ENV=test bundle exec rake db:snapshot:deps[campaign_complete]
```

## File Locations

| File | Purpose |
|------|---------|
| `db/seeds/geo_target_constants.sql` | Source data for geo_target_constants (from Google Ads API) |
| `test/fixtures/database/snapshots/*.sql` | Test snapshots |
| `spec/snapshot_builders/` | Builder classes for creating snapshots |
| `spec/snapshot_builders/builders.yml` | Builder configuration and dependencies |

## E2E Test Integration

### CI Setup

Before running Playwright, seed heavy tables once:

```bash
# In CI workflow, before running tests
RAILS_ENV=test bundle exec rake db:geo_target_constants:seed
```

### Per-Test Restore

Each test restores its required snapshot in `beforeEach`:

```typescript
test.beforeEach(async ({ page }) => {
  await DatabaseSnapshotter.restoreSnapshot("basic_account");
  await loginUser(page);
});
```

## API Endpoints (Test Environment Only)

These endpoints are only available in development/test environments:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/test/database/truncate` | POST | Truncate all non-heavy tables |
| `/test/database/restore_snapshot` | POST | Restore a snapshot |
| `/test/database/snapshots` | GET | List available snapshots |
| `/test/database/first_project` | GET | Get first project (for navigation) |

## Troubleshooting

### "geo_target_constants not found" errors

If tests fail because location data is missing:

```bash
# Locally
bundle exec rake db:geo_target_constants:seed

# On CI - ensure the seed task runs before Playwright
```

### Slow snapshot restores

If restores are slow, ensure heavy tables aren't being truncated:

```ruby
# In Database::Snapshotter, heavy tables are excluded:
EXCLUDED_HEAVY_TABLES = %w[geo_target_constants icon_embeddings]
```

### Creating new snapshots

1. Start with an existing snapshot as base
2. Make modifications in the builder
3. Run the builder to create the snapshot

```bash
RAILS_ENV=test bundle exec rake db:snapshot:build[my_new_snapshot]
```

## CI Configuration

Example CI workflow for E2E tests:

```yaml
e2e-tests:
  steps:
    - name: Setup database
      run: |
        bundle exec rake db:create db:schema:load
        bundle exec rake db:geo_target_constants:seed

    - name: Start test server
      run: bin/dev-test &

    - name: Run Playwright
      run: pnpm test:e2e
```

The seed file (`db/seeds/geo_target_constants.sql`) should be committed to the repo.
