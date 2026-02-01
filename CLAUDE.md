# Launch10 Project Guide

FOR CLAUDE CODE: You have access to skills and hooks in the .claude folder at the project root. Subfolders (langgraph_app, rails_app) also have individual .claude folders and skills.

## Overview

Launch10 is a full-stack application that helps users test their business ideas. It consists of:

A. A brainstorm agent to help users brainstorm great marketing copy
B. A landing page generator to help create and deploy user pages
C. An ads platform to help users drive traffic to their pages
D. Analytics to help users understand their successes and failures

From an engineering perspective, it is a full-stack application that consists of:

1. **Rails Frontend** (Rails 8 + Jumpstart Pro + Inertia.js + React + Vite)
2. **Langgraph Backend** (Node.js + TypeScript + AI agents for page generation)
3. **Cloudflare Deployment (Atlas)** Deploys user pages

The Rails app manages users, authentication, and project metadata. The Langgraph service handles AI-powered landing page generation and updates.

## Design System

Figma files (accessible via Figma MCP):

- **Launch10 Design System** - Component library, design tokens, states/variants
- **Launch10 Phase 2 Designs** - Screen designs and mockups

When implementing UI: check Design System for existing components first, then reference Phase 2 Designs for screen layouts.

## Project Management

ClickUp board: **Launch10**

| Tag                  | Meaning                                             |
| -------------------- | --------------------------------------------------- |
| `mvp`                | **Most important** - Must finish for v1 release     |
| `derisk`             | Could sink the business - needs due diligence first |
| `v1.5`               | Before public release (ok during family & friends)  |
| `engineering-future` | Velocity unlocks - do after MVP                     |
| `v2` / `v3`          | Future work, mild prioritization between them       |

### Team Visibility

When starting or completing **meaningful features** (not one-off fixes), post to `#claude-activity`:

- **Starting**: `🚀 Starting: [feature name] - [brief description]`
- **Completed**: `✅ Completed: [feature name] - [what was done]`

Skip this for quick fixes, typos, or minor tweaks.

## Architecture

### Frontend (Rails)

- **Framework**: Rails 8 with Jumpstart Pro as the foundation
- **Frontend Stack**: Inertia.js + React + Vite for modern SPA-like experience
- **Database**: PostgreSQL
- **Background Jobs**: Sidekiq
- **Styling**: Tailwind CSS v4
- **Authentication**: Devise with JWT support
- **Frontend File System**: WebContainers API for in-browser code execution

### Backend (Langgraph)

- **Framework**: Langgraph (LangChain's graph-based AI orchestration)
- **Server**: Hono, manages auth and Langgraph requests
- **Language**: TypeScript/Node.js
- **Database**: PostgreSQL (shared with Rails) + Redis for caching
- **AI Models**: Anthropic Claude, OpenAI GPT, Groq

### Authentication Flow

1. User logs in via Rails (Devise)
2. Rails generates JWT token with 24-hour expiry
3. JWT stored in httpOnly cookie
4. Frontend sends JWT to Langgraph in Authorization header
5. Hono validates JWT and extracts user identity
6. All Langgraph resources are scoped to authenticated user

## Project Structure

```
launch10/
├── rails_app/               # Rails frontend application
│   ├── app/
│   │   ├── controllers/     # Rails controllers (API + Inertia)
│   │   ├── javascript/      # React components & frontend code
│   │   │   └── frontend/    # Main React app code
│   │   ├── models/         # ActiveRecord models
│   │   └── views/          # Rails views (ERB + Inertia)
│   ├── config/             # Rails configuration
│   ├── db/                 # Database migrations & schema
│   └── Gemfile             # Ruby dependencies
│
├── langgraph_app/          # Langgraph backend service
│   ├── app/
│   │   ├── lib/
│   │   │   ├── server/     # Server-side code
│   │   │   │   └── langgraph/
│   │   │   │       ├── auth/    # JWT authentication
│   │   │   │       └── graphs/  # AI agent graphs
│   │   │   └── shared/     # Shared utilities
│   │   └── templates/      # Landing page templates
│   ├── db/                 # Drizzle ORM schemas & migrations
│   └── package.json        # Node.js dependencies
│
├── nginx/                  # Nginx reverse proxy config
└── docker-compose.yml      # Docker orchestration
```

## Key Commands

### Development Setup

```bash
# Initial setup (primary repo - launch10)
cd rails_app
bundle install
bundle exec rake db:create db:migrate db:seed

cd ../langgraph_app
pnpm install
pnpm run db:migrate

# Clone setup (launch1-launch4) — one command does everything
bin/setup-clone
```

### Running Development Servers

All services are managed through a unified infrastructure in `config/services.sh` and `bin/services`.

#### Environments & Ports

Ports are auto-detected from the directory name. The primary repo (`launch10/`) uses the default ports. Clones (`launch1/`-`launch4/`) get offset ports so they can run simultaneously. See [Parallel Development](#parallel-development) for details.

| Instance | Environment | Rails | Langgraph | Vite |
| -------- | ----------- | ----- | --------- | ---- |
| launch10 | development | 3000  | 4000      | 3036 |
| launch10 | test/e2e    | 3001  | 4001      | 3037 |
| launch1  | development | 3100  | 4100      | 3136 |
| launch1  | test/e2e    | 3101  | 4101      | 3137 |
| launch2  | development | 3200  | 4200      | 3236 |
| launch2  | test/e2e    | 3201  | 4201      | 3237 |
| launch3  | development | 3300  | 4300      | 3336 |
| launch3  | test/e2e    | 3301  | 4301      | 3337 |
| launch4  | development | 3400  | 4400      | 3436 |
| launch4  | test/e2e    | 3401  | 4401      | 3437 |

#### Development Mode

```bash
# From project root - runs Rails, Vite, and Langgraph together
cd rails_app
bin/dev

# Or use the unified services command
bin/services dev          # Core services (rails + vite + langgraph)
bin/services dev --full   # All services (+ sidekiq, zhong, stripe)
```

#### Test/E2E Mode

```bash
# For running Playwright e2e tests
cd rails_app
bin/dev-test              # Starts all services on test ports

# Or run Playwright directly (auto-starts services)
pnpm test:e2e             # Headless
pnpm test:e2e:ui          # With Playwright UI
```

#### Service Management

```bash
bin/services status       # Check what's running
bin/services cleanup      # Kill all managed services
bin/services env          # Show current environment config
```

### Database Commands

```bash
# Rails
bundle exec rake db:migrate
bundle exec rake db:seed

# Langgraph
pnpm run db:generate    # Generate migrations from schema changes
pnpm run db:migrate     # Run migrations
pnpm run db:seed        # Seed database
```

### Testing & Linting

```bash
# Rails
bundle exec rspec
bundle exec rubocop

# Langgraph
pnpm run test
pnpm run lint
pnpm run typecheck
```

### Claude Code MCP Servers

```bash
# Slack (for #claude-activity updates)
claude mcp add slack \
  -e SLACK_BOT_TOKEN=$(rails credentials:show | grep slack_bot_token | awk '{print $2}') \
  -e SLACK_TEAM_ID=T09K6AU3TPG \
  -- npx -y @modelcontextprotocol/server-slack
```

Restart Claude Code after adding MCP servers.

## Key Models & Concepts

### Core (Multi-tenancy)

- **Account**: Team/organization (multi-tenant root)
- **User**: Authenticated users (Devise + JWT)
- **Project**: Container for a single business idea test
  - Has one Website, one Brainstorm, many Campaigns
- **ProjectWorkflow**: Tracks user's current step (brainstorm → website → ads)
- **Chat**: Polymorphic conversation context (linked to Brainstorm or Campaign)
  - Has `thread_id` that links to Langgraph

### A. Brainstorm Agent

- **Brainstorm**: Captures idea, audience, solution, social proof
  - `belongs_to :website`, `has_one :chat`

### B. Landing Page Generator

- **Website**: The landing page being built
  - `belongs_to :project`
  - `has_many :code_files` (the actual source files)
  - `has_many :domains`, `has_many :deploys`
- **CodeFile**: Individual source files (HTML, CSS, JS, images)
- **Template** / **Theme**: Base templates and visual themes
- **Deploy**: Deployment record (pending → building → completed)
- **Domain**: Custom domain configuration

### C. Ads Platform

- **Campaign**: Ad campaign (Google Ads, Meta)
  - `has_many :ad_groups`, `location_targets`, `languages`, `schedules`
- **AdGroup**: Contains ads and keywords
- **Ad**: Individual ad with headlines/descriptions
- **AdKeyword**, **AdLocationTarget**, **AdSchedule**, **AdBudget**

### D. Analytics

- **AccountRequestCount** / **DomainRequestCount**: Traffic metrics per account/domain

### Langgraph Concepts

- **Graphs**: AI agent workflows (router, brainstorm, website, ads)
- **Threads**: Conversation contexts linked to Chat records
- **Checkpoints**: State snapshots for each conversation
- **WebContainers**: In-browser Node.js environment for code execution

## Environment Variables

### Rails (.env or credentials)

```bash
DATABASE_URL=postgres://...
REDIS_URL=redis://...
JWT_SECRET=your-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

### Langgraph (.env)

```bash
JWT_SECRET=same-as-rails-secret
ALLOWED_HOSTS=localhost:3000,localhost:5173
POSTGRES_URI=postgres://...
REDIS_URI=redis://...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

## Authentication Details

JWT tokens are issued by Rails and validated by Langgraph:

- Generated in `app/controllers/concerns/authorization.rb`
- Contains: user ID (sub), expiry (exp), issued at (iat), JWT ID (jti)
- Stored in httpOnly cookie for web requests
- Sent in Authorization header for API requests
- Validated in `langgraph_app/app/lib/server/langgraph/auth/auth.ts`

## Common Workflows

### Creating a New Landing Page

1. User enters a message in the chat interface
2. Langgraph runs router graph to determine which graph to run, and tells Rails to create a new project
3. Rails creates a new project and frontend redirects to the project view
4. Langgraph runs the create graph and generates the landing page files
5. Langgraph sends Rails the final project files, and Rails stores them in the database
6. Frontend displays the landing page in the WebContainer

### Debugging Issues

1. **Rails logs**: `tail -f log/development.log`
2. **Langgraph logs**: Check terminal running `pnpm run dev`
3. **Browser DevTools**: Network tab for API calls
4. **Database**: Use Rails console or psql to inspect data

#### Debugging Rails with `binding.pry` (E2E Tests)

When running e2e tests, services run via Overmind. To use `binding.pry` in Rails:

```bash
# Terminal 1: Start services in test mode
cd rails_app
bin/dev-test

# Terminal 2: Attach to the Rails process
cd rails_app
OVERMIND_SOCKET=.overmind-test.sock overmind connect web
```

Now when your code hits a `binding.pry`, you can interact with it in Terminal 2.

**To detach**: Press `Ctrl+B` then `D` (it's a tmux session).

**Socket paths by environment**:

- Development: `.overmind-dev.sock`
- Test/E2E: `.overmind-test.sock`

### Adding New Features

1. **Rails side**: Add models, controllers, and Inertia pages
2. **Langgraph side**: Create new graph or modify existing ones
3. **Frontend**: Add React components in `rails_app/app/javascript/frontend/`
4. **Remember**: Always run migrations and update both services

## Security Considerations

- JWTs expire after 24 hours
- All Langgraph resources are scoped to authenticated users
- CORS is enforced via ALLOWED_HOSTS
- Sensitive keys stored in Rails credentials or environment variables
- Database connections use SSL in production

## Google Ads Browser Automation

When using browser automation to access Google Ads (ads.google.com):

1. **Always use a launch10.ai account** - Ensure you are logged in with a @launch10.ai Google account
2. **Only use the test account** - Always select "Launch10 MCC Test Account" (ID: 124-895-7009)
3. **Never access other accounts** - Do not log into any other Google Ads accounts, even if they appear in the account selector

This ensures all testing and development work is isolated to the designated test environment.

## Parallel Development

Multiple Claude Code agents (or developers) can work simultaneously by running the repo from separate clones (`launch1/`-`launch4/`). Each clone gets its own ports, databases, and Redis namespace automatically based on the directory name.

### How It Works

`config/services.sh` detects the directory name at startup:

- `launch10/` (the primary repo) uses default ports (3000/4000/3036), database prefix `launch10`, Redis DB 0
- `launch1/`-`launch4/` use offset ports, separate databases, and separate Redis DBs

All isolation is automatic — no manual configuration needed.

### Setting Up a Clone

```bash
# 1. Clone the repo into a numbered directory
cd ~/programming/business
git clone <repo-url> launch3

# 2. Run the one-command setup
cd launch3
bin/setup-clone
```

`bin/setup-clone` does the following:

1. Detects the instance from the directory name
2. Copies `.env` files from `launch10/` and substitutes all instance-specific values (ports, DATABASE_URL, REDIS_URL, ALLOWED_HOSTS)
3. Creates Postgres databases (`launch3_development`, `launch3_test`)
4. Runs Rails migrations (dev + test)
5. Reflects Langgraph Drizzle schema
6. Seeds the development database
7. Installs Ruby and Node dependencies

The script is idempotent — safe to run again at any time. It also supports partial runs:

```bash
bin/setup-clone --env    # Only regenerate .env files
bin/setup-clone --db     # Only create databases and run migrations
```

### Instance Isolation

| Resource   | launch10 (primary)       | launch2 (clone)          |
| ---------- | ------------------------ | ------------------------ |
| Rails port | 3000                     | 3200                     |
| LG port    | 4000                     | 4200                     |
| Vite port  | 3036                     | 3236                     |
| Dev DB     | launch10_development     | launch2_development      |
| Test DB    | launch10_test            | launch2_test             |
| Redis      | redis://localhost:6379/0 | redis://localhost:6379/2 |

Sidekiq and Zhong use `REDIS_URL` from the environment, so their queues and locks are isolated per instance with no additional configuration.

### Checking Instance Config

```bash
bin/services env    # Shows instance, ports, databases, Redis
```

## Coding Patterns

### Worker Batch Pattern

When processing collections of records in background jobs, use a **batch coordinator + individual worker** pattern for granular retries:

```ruby
# BAD: One failure kills the whole batch
class ProcessAllAccountsWorker < ApplicationWorker
  def perform
    Account.find_each do |account|
      process_account(account)  # If this fails, the whole job fails
    rescue => e
      Rails.logger.error("Failed for #{account.id}")
      # Continues, but no automatic retry for this account
    end
  end
end

# GOOD: Granular retries per item
class ProcessAllAccountsWorker < ApplicationWorker
  def perform
    Account.find_each do |account|
      ProcessAccountWorker.perform_async(account.id)
    end
  end
end

class ProcessAccountWorker < ApplicationWorker
  sidekiq_options retry: 3  # Each account gets its own retries

  def perform(account_id)
    account = Account.find(account_id)
    AccountProcessingService.new(account).call
  end
end
```

**Benefits:**

- Individual items retry independently
- Failed items don't block successful ones
- Better observability (see which specific items failed)
- Parallelism scales with Sidekiq concurrency

### Service Objects for Business Logic

Workers should be thin - just orchestration. Push business logic to service classes:

```ruby
# Worker: thin, just calls the service
class SyncPerformanceForAccountWorker < ApplicationWorker
  def perform(ads_account_id)
    ads_account = AdsAccount.find(ads_account_id)
    Analytics::SyncService.new(ads_account).sync_google_ads
  end
end

# Service: contains the actual logic
class Analytics::SyncService
  def initialize(ads_account)
    @ads_account = ads_account
  end

  def sync_google_ads
    # All the business logic lives here
  end
end
```

**Benefits:**

- Services are easily testable without Sidekiq
- Logic can be reused (console, rake tasks, other workers)
- Workers remain simple to understand

### Qualified Constant Names in Namespaced Modules

**Always use fully-qualified constant names** when referencing sibling classes in namespaced modules. This prevents Zeitwerk autoloading issues.

```ruby
# BAD: Unqualified reference fails with Zeitwerk
module Credits
  class ChargeRunWorker < ApplicationWorker
    def perform(run_id)
      cost = CostCalculator.new(record).call  # NameError: uninitialized constant Credits::ChargeRunWorker::CostCalculator
    end
  end
end

# GOOD: Fully-qualified reference works reliably
module Credits
  class ChargeRunWorker < ApplicationWorker
    def perform(run_id)
      cost = Credits::CostCalculator.new(record).call  # Always works
    end
  end
end
```

**Why this matters:**

- When Ruby sees `CostCalculator` inside `Credits::ChargeRunWorker`, it first looks for `Credits::ChargeRunWorker::CostCalculator`
- Zeitwerk tries to autoload from that path, which doesn't exist
- The error only surfaces when the sibling class hasn't been loaded yet (test isolation, load order)
- Using qualified names (`Credits::CostCalculator`) makes the lookup explicit and reliable

**The test suite verifies this:** `rails_helper.rb` calls `Rails.application.eager_load!` before tests to catch these issues early.

### Inertia Navigation Pattern

**Always use `router.visit()` for navigation** instead of `<a href="...">` tags. This ensures proper SPA behavior with browser back/forward button support.

```typescript
// BAD: Regular anchor tag breaks SPA navigation
<a href="/settings">Go to Settings</a>

// GOOD: Inertia router with proper back button support
import { router } from "@inertiajs/react";

<button
  onClick={() => router.visit("/settings")}
  className="..."
>
  Go to Settings
</button>
```

## Tips

- Use `pnpm` for Langgraph, not `npm` or `yarn`
- When debugging Langgraph, use single worker mode (`-n 1`)
- Rails and Langgraph share the same PostgreSQL database
- WebContainer files are stored as JSON in the database
- Always check both Rails and Langgraph logs when debugging

## MCP Servers

### CircleCI:

Engineers that need to enable this can run:

```bash
claude mcp add circleci-mcp-server -e CIRCLECI_TOKEN=<token in rails.credentials> -- npx -y @circleci/mcp-server-circleci@latest
```
