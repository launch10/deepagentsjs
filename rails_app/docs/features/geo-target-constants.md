# Geo Target Constants

Google Ads location targeting data used for ad campaign geographic targeting.

## Overview

`geo_target_constants` contains ~228K location records from Google Ads API including cities, regions, countries, airports, and other targetable locations. This data is used when users configure location targeting for their ad campaigns.

## Data Source

The data originates from Google Ads API's `GeoTargetConstantService`. It's exported and stored in:

```
db/seeds/geo_target_constants.sql
```

## Schema

```ruby
# app/models/geo_target_constant.rb
class GeoTargetConstant < ApplicationRecord
  # criteria_id    - Google's unique identifier for the location
  # name           - Display name (e.g., "New York")
  # canonical_name - Full path (e.g., "New York,New York,United States")
  # parent_id      - Parent location's criteria_id
  # country_code   - ISO country code
  # target_type    - City, Region, Country, Airport, etc.
  # status         - Active or Removed
end
```

## Rake Tasks

```bash
# Seed geo_target_constants into the database
bundle exec rake db:geo_target_constants:seed

# Dump current data to snapshot file
bundle exec rake db:geo_target_constants:dump

# Refresh: seed then dump (use after updating seed file)
bundle exec rake db:geo_target_constants:refresh
```

## File Locations

| File                                                        | Purpose                  |
| ----------------------------------------------------------- | ------------------------ |
| `db/seeds/geo_target_constants.sql`                         | Source seed data (~69MB) |
| `test/fixtures/database/snapshots/geo_target_constants.sql` | Test snapshot (~69MB)    |
| `app/models/geo_target_constant.rb`                         | ActiveRecord model       |
| `app/controllers/api/v1/geo_target_constants_controller.rb` | API endpoint             |

## Test Environment

Geo target constants are treated as "heavy tables" - they're loaded once before tests start and preserved across snapshot restores to keep tests fast.

### E2E Tests (CI)

Seed geo_target_constants once before running Playwright (generally only needed in CI unless you truncated locally):

```bash
# In CI setup, before running tests
RAILS_ENV=test bundle exec rake db:geo_target_constants:seed
```

Individual test snapshots don't include this data - it's preserved across restores.

### Local Development

```bash
# Seed once when setting up your dev environment
bundle exec rake db:geo_target_constants:seed
```

## Updating the Data

To update geo_target_constants with fresh data from Google Ads:

1. Export new data from Google Ads API
2. Replace `db/seeds/geo_target_constants.sql`
3. Run the refresh task:

```bash
bundle exec rake db:geo_target_constants:refresh
```

4. Commit both files:
   - `db/seeds/geo_target_constants.sql`
   - `test/fixtures/database/snapshots/geo_target_constants.sql`

## API Usage

```bash
# Search locations by name
GET /api/v1/geo_target_constants?q=new+york

# Get by criteria_id
GET /api/v1/geo_target_constants/:criteria_id
```

## Performance Notes

- ~228K records, ~69MB SQL file
- Loading takes ~10-15 seconds
- Excluded from normal test truncation to avoid slow test runs
- Indexed on `criteria_id`, `name`, `country_code`, `target_type`
