# Rails Migrations

## Overview

This skill covers best practices for writing Rails migrations using strong_migrations patterns and our project conventions.

## Key Rules

### 1. Never Use `references` - Use `bigint` Instead

```ruby
# BAD - generates foreign key constraint automatically
add_reference :job_runs, :deploy, foreign_key: true

# GOOD - explicit bigint column
add_column :job_runs, :deploy_id, :bigint
add_index :job_runs, :deploy_id, algorithm: :concurrently
```

### 2. Always Add Indexes Concurrently

```ruby
class AddDeployIdToJobRuns < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :job_runs, :deploy_id, :bigint
    add_index :job_runs, :deploy_id, algorithm: :concurrently
  end
end
```

### 3. Safe Column Additions

Adding columns is generally safe, but be careful with:

```ruby
# BAD - default value locks table
add_column :users, :active, :boolean, default: true

# GOOD - add column, then backfill, then add default
add_column :users, :active, :boolean
# Then in a separate migration or rake task:
# User.in_batches.update_all(active: true)
# Then add default in another migration:
# change_column_default :users, :active, true
```

### 4. Renaming Tables/Columns

Use `safety_assured` only for new tables not yet in production:

```ruby
class RenameModelFallbackChainsToModelPreferences < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      rename_table :model_fallback_chains, :model_preferences
    end
  end
end
```

For tables in production, follow the multi-step approach in strong_migrations docs.

### 5. Removing Columns

Always ignore the column in the model first:

```ruby
# 1. First PR: Add to model
class User < ApplicationRecord
  self.ignored_columns += ["legacy_field"]
end

# 2. Deploy, then second PR: Remove column
class RemoveLegacyFieldFromUsers < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      remove_column :users, :legacy_field
    end
  end
end
```

## Common Patterns

### Adding a Foreign Key Column

```ruby
class AddProjectIdToWidgets < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :widgets, :project_id, :bigint
    add_index :widgets, :project_id, algorithm: :concurrently
  end
end
```

Then in the model:

```ruby
class Widget < ApplicationRecord
  belongs_to :project, optional: true
end
```

### Adding a Timestamp Column

```ruby
class AddUserActiveAtToDeploys < ActiveRecord::Migration[8.0]
  def change
    add_column :deploys, :user_active_at, :datetime
  end
end
```

### Adding an Enum-like String Column

```ruby
class AddStatusToOrders < ActiveRecord::Migration[8.0]
  def change
    add_column :orders, :status, :string
    add_index :orders, :status
  end
end
```

## Running Migrations

```bash
# Development
bin/rails db:migrate

# Test database
RAILS_ENV=test bin/rails db:migrate

# Rollback
bin/rails db:rollback STEP=1
```

## Troubleshooting

### Strong Migrations Blocking

If strong_migrations blocks your migration:

1. **Read the error** - it explains what's dangerous and suggests alternatives
2. **For development-only tables** - use `safety_assured { }` block
3. **For production tables** - follow the suggested multi-step approach

### Migration Already Run But Needs Changes

```bash
# Rollback the migration
bin/rails db:rollback STEP=1

# Edit the migration file

# Re-run
bin/rails db:migrate
```
