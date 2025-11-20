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

## Architecture

### Frontend (Rails)

- **Framework**: Rails 8 with Jumpstart Pro as the foundation
- **Frontend Stack**: Inertia.js + React + Vite for modern SPA-like experience
- **Database**: PostgreSQL
- **Background Jobs**: Sidekiq
- **Styling**: Tailwind CSS v4
- **Authentication**: Devise with JWT support
- **File System**: WebContainers API for in-browser code execution

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

```bash
# Rails (from rails_app/)
bin/dev
# This runs Rails server, Vite, Sidekiq, and Stripe CLI

# Langgraph (from langgraph_app/)
pnpm run dev
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

### Docker Development

```bash
# Build and run all services
docker compose up

# Run with custom Postgres/Redis
# Update langgraph_app/.env.docker with host.docker.internal URLs
docker build -t launch10 ./langgraph_app
docker compose up
```

## Key Models & Concepts

### Rails Models

- **User**: Authenticated users (Devise + JWT)
- **Account**: Multi-tenant accounts (teams/organizations)
- **Project**: User's landing page projects
  - Has a `thread_id` that links to Langgraph conversation
  - Contains project metadata and file references
- **ProjectFile**: Individual files within a project
- **Template**: Base templates for landing pages
- **Page/Section**: Page structure and content

### Langgraph Concepts

- **Graphs**: AI agent workflows (router, create, update)
- **Threads**: Conversation contexts linked to Rails projects
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

## Tips

- Use `pnpm` for Langgraph, not `npm` or `yarn`
- When debugging Langgraph, use single worker mode (`-n 1`)
- Rails and Langgraph share the same PostgreSQL database
- WebContainer files are stored as JSON in the database
- Always check both Rails and Langgraph logs when debugging
