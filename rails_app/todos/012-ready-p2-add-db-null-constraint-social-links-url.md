---
status: done
priority: p2
issue_id: "012"
tags: [code-review, data-integrity, database, brainstorm-ui]
dependencies: []
---

# Add NOT NULL Constraint to social_links.url Column

## Problem Statement

The social_links migration allows `url` to be NULL at the database level, but the model requires it. This mismatch could allow NULL urls to enter the database via raw SQL or direct database access.

## Findings

**Migration (allows NULL):**
```ruby
# db/migrate/20251229001513_create_social_links.rb
t.string :url  # No null: false
```

**Model (requires it):**
```ruby
# app/models/social_link.rb
validates :url, presence: true, format: { with: URI::DEFAULT_PARSER.make_regexp(%w[http https]) }
```

**Risk:** If data is inserted via:
- Raw SQL
- Database import
- Rails console with `save(validate: false)`
- Future bug in code

NULL urls could enter the database, causing inconsistency.

## Proposed Solutions

### Option 1: Add Migration to Add NOT NULL Constraint (Recommended)

```ruby
class AddNotNullToSocialLinksUrl < ActiveRecord::Migration[8.0]
  def change
    change_column_null :social_links, :url, false
  end
end
```

**Pros:** Database enforces constraint, defense in depth
**Cons:** Requires migration, could fail if NULLs exist
**Effort:** Small
**Risk:** Low (new table, no existing data)

### Option 2: Accept Model-Only Validation
Document that the model enforces the constraint.

**Pros:** No migration needed
**Cons:** Risk of data inconsistency remains
**Effort:** None
**Risk:** Low (but not zero)

## Recommended Action

Option 1 - Add the constraint. This is a new table with no existing data, so the migration is safe.

## Technical Details

**Create migration:**
```bash
bin/rails generate migration AddNotNullToSocialLinksUrl
```

**Migration content:**
```ruby
class AddNotNullToSocialLinksUrl < ActiveRecord::Migration[8.0]
  def change
    change_column_null :social_links, :url, false
  end
end
```

## Acceptance Criteria

- [x] Migration created and run
- [x] `db/structure.sql` shows `url` column as NOT NULL
- [x] Tests still pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-30 | Created | Identified during data integrity review |
| 2025-12-30 | Approved | Triage approved - status: ready |
| 2025-12-30 | Resolved | Migration created with safety_assured (new table, no existing data) |

## Resources

- Data integrity guardian report
- Migration: `db/migrate/20251229001513_create_social_links.rb`
