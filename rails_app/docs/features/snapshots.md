# Database Snapshots

## Why Snapshots?

Database snapshots solve several problems in our development and testing workflow:

1. **Langgraph Integration Tests**: Our langgraph backend tests need to run against a Rails database in a known state (e.g. "Start when we already have a website built"). Snapshots let us restore a consistent starting point before each test run.

2. **Fast Test Setup**: Instead of running slow seed scripts before each test, we restore a pre-built snapshots.

3. **Reproducible State**: Snapshots guarantee the exact same data every time, eliminating flaky tests caused by non-deterministic seeding.

4. **Dependency Chain**: Complex test scenarios (e.g., "campaign with ads") can build on simpler ones (e.g., "user with subscription"), avoiding duplicate setup code.

## How Builders Work

Builders are Ruby classes that set up database state. Each builder:

- Inherits from `BaseBuilder`
- Defines a `base_snapshot` (the snapshot to restore before running)
- Defines an `output_name` (the snapshot name to create)
- Implements a `build` method that creates the data

### Dependency Chain

Builders form a dependency chain. When you build a snapshot, all missing dependencies are built first:

```
core_data -> basic_account -> website_created -> campaign_created
```

Running `rake db:snapshot:build[campaign_created]` will automatically build `core_data`, `basic_account`, and `website_created` if they don't exist.

### Builder Configuration

Builders are registered in `spec/snapshot_builders/builders.yml`:

```yaml
core_data:
  class: CoreData
  description: "Seeds plans, templates, and themes (no accounts)"

basic_account:
  class: BasicAccount
  description: "Creates a subscribed test user account"

website_created:
  class: WebsiteCreated
  description: "Creates a website with brainstorm data"

campaign_created:
  class: CampaignCreated
  description: "Creates a campaign with ad groups and ads"
```

### Creating a New Builder

1. Create a class in `spec/snapshot_builders/`:

```ruby
class MyFeatureCreated < BaseBuilder
  def base_snapshot
    "basic_account"  # Start from this snapshot
  end

  def output_name
    "my_feature_created"  # Save as this snapshot
  end

  def build
    account = Account.first
    # ... create your test data
  end
end
```

2. Register it in `builders.yml`:

```yaml
my_feature_created:
  class: MyFeatureCreated
  description: "Creates data for my feature tests"
```

## Running Seeds (Development)

For local development, use Rails seeds which now use the same builder classes:

```bash
# Seed development database
rails db:seed

# Reset and seed
rails db:reset
```

This runs `CoreData` and `BasicAccount` builders to set up plans, templates, themes, and a test user.

## Working with Snapshots

### List Available Builders

```bash
RAILS_ENV=test rake db:snapshot:list
```

### View Dependency Chain

```bash
# Show all dependencies
RAILS_ENV=test rake db:snapshot:deps

# Show deps for specific builder
RAILS_ENV=test rake "db:snapshot:deps[campaign_created]"
```

### Build a Snapshot

```bash
# Build a specific snapshot (and all its dependencies)
RAILS_ENV=test rake "db:snapshot:build[campaign_created]"

# Build just core_data
RAILS_ENV=test rake "db:snapshot:build[core_data]"
```

Snapshots are stored in `test/fixtures/database/snapshots/`.

### Restore a Snapshot

```bash
# Restore with truncation first (recommended)
RAILS_ENV=test rake "db:restore_snapshot[basic_account]"

# Restore without truncation
RAILS_ENV=test rake "db:restore_snapshot[basic_account,false]"
```

### Interactive Mode

For ad-hoc data creation, use interactive mode:

```bash
RAILS_ENV=test rake "db:snapshot:interactive[basic_account]"
```

This restores the base snapshot and drops you into an IRB session with FactoryBot and helpers available. When done, call `save_snapshot('my_snapshot')`.

## Snapshot Files

Snapshots are PostgreSQL data dumps stored as `.sql` files:

- **Location**: `test/fixtures/database/snapshots/`
- **Format**: Data-only (no schema), uses `pg_dump --data-only --inserts`
- **Portability**: Can be restored to any database with the same schema

## Using Snapshots in Tests

### RSpec Integration

Restore a snapshot in a `before` block (outside of transactions):

```ruby
RSpec.describe "My Feature", type: :request do
  before(:all) do
    # Restore snapshot before all tests in this file
    snapshot_path = Rails.root.join("test/fixtures/database/snapshots/basic_account.sql")
    Database::Snapshotter.restore(snapshot_path)
  end

  # ... tests
end
```

**Important**: Don't restore snapshots inside individual tests when using transactional fixtures - the `psql` process will deadlock waiting for the transaction to release locks.

### Langgraph Tests

The langgraph test suite restores snapshots before running integration tests:

```typescript
// In langgraph test setup
await restoreSnapshot("campaign_created");
// Now the Rails database has a campaign ready for testing
```

## Best Practices

1. **Keep snapshots small**: Only include data needed for tests
2. **Use the dependency chain**: Don't duplicate setup across builders
3. **Name descriptively**: `campaign_created` not `test_data_1`
4. **Rebuild after schema changes**: Snapshots are data-only, so they break if columns change
5. **Don't commit large snapshots**: Add to `.gitignore` if they grow large
