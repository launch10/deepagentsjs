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

| Tag | Meaning |
|-----|---------|
| `mvp` | **Most important** - Must finish for v1 release |
| `derisk` | Could sink the business - needs due diligence first |
| `v1.5` | Before public release (ok during family & friends) |
| `engineering-future` | Velocity unlocks - do after MVP |
| `v2` / `v3` | Future work, mild prioritization between them |

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
# Initial setup
cd rails_app
bundle install
bundle exec rake db:create db:migrate db:seed

cd ../langgraph_app
pnpm install
pnpm run db:migrate
```

### Running Development Servers

All services are managed through a unified infrastructure in `config/services.sh` and `bin/services`.

#### Environments & Ports

| Environment | Rails Port | Langgraph Port | Vite Port |
| ----------- | ---------- | -------------- | --------- |
| development | 3000       | 4000           | 3036      |
| test/e2e    | 3001       | 4001           | 3037      |

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
