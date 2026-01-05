# Database Snapshots

## When to Use

Use snapshots when you need to:

- Debug an issue at a specific point in the user journey
- Run tests that require existing data state
- Skip slow setup steps during development

## Available Snapshots

| Snapshot                | Description                            | Use Case                   |
| ----------------------- | -------------------------------------- | -------------------------- |
| `core_data`             | Plans, templates, themes (no accounts) | Base data testing          |
| `basic_account`         | Subscribed test user account           | Most common starting point |
| `website_step`          | Website with brainstorm data           | Testing website features   |
| `campaign_content_step` | Campaign with ad groups and ads        | Testing ads features       |

## Commands

### List available snapshots

```bash
cd rails_app
RAILS_ENV=test rake db:snapshot:list
```

### View dependency chain

```bash
RAILS_ENV=test rake db:snapshot:deps
RAILS_ENV=test rake "db:snapshot:deps[campaign_content_step]"
```

### Build a snapshot

```bash
# Builds the snapshot and all its dependencies
RAILS_ENV=test rake "db:snapshot:build[campaign_content_step]"
```

### Restore a snapshot

```bash
# Restore with truncation (recommended)
RAILS_ENV=test rake "db:restore_snapshot[basic_account]"

# Restore without truncation
RAILS_ENV=test rake "db:restore_snapshot[basic_account,false]"
```

### Interactive mode (for creating new snapshots)

```bash
RAILS_ENV=test rake "db:snapshot:interactive[basic_account]"
# When done, call: save_snapshot('my_snapshot')
```

## Creating a New Snapshot

1. Create a builder class in `rails_app/spec/snapshot_builders/`:

```ruby
class MyFeatureCreated < BaseBuilder
  def base_snapshot
    "basic_account"  # Start from this snapshot
  end

  def output_name
    "my_feature_created"
  end

  def build
    account = Account.first
    # Create your test data here
  end
end
```

2. Register in `spec/snapshot_builders/builders.yml`:

```yaml
my_feature_created:
  class: MyFeatureCreated
  description: "Creates data for my feature tests"
```

3. Build the snapshot:

```bash
RAILS_ENV=test rake "db:snapshot:build[my_feature_created]"
```

## Using in Langgraph Tests

```typescript
// Restore snapshot before running test
await restoreSnapshot("campaign_content_step");
```

## Important Notes

- Snapshots are stored in `rails_app/test/fixtures/database/snapshots/`
- Rebuild snapshots after schema changes
- Don't restore inside individual tests with transactional fixtures (will deadlock)
- Keep snapshots small - only include data needed for tests
