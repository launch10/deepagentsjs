# Playwright Server Helpers Architecture

## Overview

Launch10 uses the **cypress-on-rails** gem for server-side test helpers in Playwright e2e tests. This provides a clean separation between database operations (snapshots) and test data manipulation (scenarios, factories, queries).

## Architecture

```
e2e/
├── app_commands/           # Ruby commands executed server-side
│   ├── clean.rb            # Database truncation
│   ├── eval.rb             # Arbitrary Ruby evaluation (use sparingly)
│   ├── factory_bot.rb      # FactoryBot wrapper
│   ├── log_fail.rb         # Error logging
│   ├── timecop.rb          # Time manipulation
│   ├── scenarios/          # Pre-built test states
│   │   ├── basic.rb
│   │   ├── set_credits.rb
│   │   ├── fill_subdomain_limit.rb
│   │   ├── assign_platform_subdomain.rb
│   │   ├── assign_custom_domain.rb
│   │   └── set_stripe_price.rb
│   └── queries/            # Data retrieval
│       ├── first_project.rb
│       └── first_website.rb
├── support/
│   └── on-rails.ts         # TypeScript client for calling commands
└── fixtures/
    └── database.ts         # Database snapshot operations only
```

## How It Works

1. **Middleware**: cypress-on-rails mounts at `/__e2e__/command`
2. **TypeScript client** (`e2e/support/on-rails.ts`) provides typed functions
3. **Ruby commands** in `e2e/app_commands/` execute in Rails context
4. Results returned as JSON

## TypeScript API

```typescript
import { appScenario, appQuery, appFactories, clean, timecop } from "./support/on-rails";
import { DatabaseSnapshotter } from "./fixtures/database";

// Database snapshots (restores SQL dumps)
await DatabaseSnapshotter.restoreSnapshot("website_step");

// Scenarios (pre-built test states)
await appScenario("fill_subdomain_limit", { email: "test@example.com" });
await appScenario("assign_platform_subdomain", { website_id: 1, subdomain: "my-site", path: "/" });
await appScenario("set_credits", { email: "test@example.com", credits: 0 });

// Queries (data retrieval)
const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
const website = await appQuery<{ id: number; name: string }>("first_website");

// FactoryBot (when snapshot doesn't have what you need)
await appFactories([["create", "user", { email: "test@example.com" }]]);

// Time manipulation
await timecop.freeze("2024-01-01 12:00:00");
await timecop.return();

// Clean (use cypress-on-rails clean, not snapshot truncate)
await clean();
```

## Test Pattern

```typescript
test.describe("Feature", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Restore snapshot (baseline state)
    await DatabaseSnapshotter.restoreSnapshot("website_step");

    // 2. Get references to records
    const project = await appQuery<{ id: number; uuid: string }>("first_project");

    // 3. Layer scenarios on top
    await appScenario("fill_subdomain_limit", { email: testUser.email });

    // 4. Login
    await loginUser(page);
  });

  test("does something", async ({ page }) => {
    // Test code
  });
});
```

## When to Use What

| Need                           | Use                                     |
| ------------------------------ | --------------------------------------- |
| Baseline database state        | `DatabaseSnapshotter.restoreSnapshot()` |
| Modify state for specific test | `appScenario()`                         |
| Get record IDs/data            | `appQuery()`                            |
| Create records not in snapshot | `appFactories()`                        |
| Time-based testing             | `timecop`                               |
| Full truncation (rare)         | `clean()`                               |

## Creating New Commands

### New Scenario

```ruby
# e2e/app_commands/scenarios/my_scenario.rb

# Documentation for what this does
# Usage: await appScenario('my_scenario', { param: value })
#
# Options:
#   param: string - Description

param = command_options[:param] || command_options["param"]

# Your Ruby code here
user = User.find_by!(email: param)
# ...

# Return hash with results
{ user_id: user.id, created: true }
```

### New Query

```ruby
# e2e/app_commands/queries/my_query.rb

record = SomeModel.first
{
  id: record.id,
  name: record.name,
  # other fields...
}
```

## Configuration

### Rails Initializer

```ruby
# config/initializers/cypress_on_rails.rb
CypressOnRails.configure do |c|
  c.api_prefix = ""
  c.install_folder = File.expand_path("#{__dir__}/../../e2e")
  c.use_middleware = !Rails.env.production?
  c.logger = Rails.logger
end
```

### Helper Loading

```ruby
# e2e/e2e_helper.rb
# Loaded once before first command
require 'database_cleaner-active_record'
require 'factory_bot_rails'
require 'cypress_on_rails/smart_factory_wrapper'

CypressOnRails::SmartFactoryWrapper.configure(
  always_reload: false,
  factory: FactoryBot,
  files: [
    Rails.root.join('spec', 'factories.rb'),
    Rails.root.join('spec', 'factories', '**', '*.rb')
  ]
)
```

## Separation of Concerns

| Component                  | Purpose                             | Location                |
| -------------------------- | ----------------------------------- | ----------------------- |
| `Test::DatabaseController` | Database-level ops (snapshots only) | `app/controllers/test/` |
| App Commands               | Test data manipulation              | `e2e/app_commands/`     |
| `on-rails.ts`              | TypeScript client                   | `e2e/support/`          |
| `database.ts`              | Snapshot operations                 | `e2e/fixtures/`         |

The `Test::DatabaseController` was cleaned up to only handle database-level operations. All test data manipulation (setting credits, filling limits, assigning domains) moved to `e2e/app_commands/scenarios/`.

## Benefits

- **Organized**: Commands grouped by purpose (scenarios, queries, etc.)
- **Discoverable**: `ls e2e/app_commands/scenarios/`
- **Type-safe**: TypeScript generics for return types
- **Reusable**: Same commands work for any test
- **Single entry point**: All commands go through `/__e2e__/command`
