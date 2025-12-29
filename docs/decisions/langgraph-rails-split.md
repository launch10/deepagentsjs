# Why Langgraph is Separate from Rails

## The Problem

Launch10 needs both traditional web application capabilities (authentication, payments, CRUD operations) and AI-powered agent workflows (brainstorming, page generation, ad creation). These have fundamentally different characteristics.

## The Decision

Run Langgraph as a separate TypeScript/Node.js service that communicates with the Rails app via JWT-authenticated API calls.

```
┌─────────────────┐     JWT      ┌──────────────────┐
│   Rails App     │◄────────────►│  Langgraph App   │
│  (Port 3000)    │              │   (Port 2024)    │
│                 │              │                  │
│ - Auth/Users    │              │ - AI Agents      │
│ - Projects      │              │ - Brainstorm     │
│ - Payments      │              │ - Ads Builder    │
│ - Deployments   │              │ - (Website Gen)  │
│ - File Storage  │              │                  │
└────────┬────────┘              └────────┬─────────┘
         │                                │
         └──────────┬─────────────────────┘
                    ▼
              PostgreSQL
              (Shared DB)
```

## Why This Approach

### Rails is better for web standards

Rails is significantly more opinionated, which is preferable in the AI-driven world. When Claude or other agents work on the Rails codebase, they can make canonically correct decisions because Rails has clear conventions:

- RESTful routing patterns
- ActiveRecord migrations and associations
- Devise for authentication
- Sidekiq for background jobs
- Clear MVC separation

The agent doesn't have to guess "how should I structure this?" - Rails has already decided.

### Langgraph/TypeScript is better for AI orchestration

AI agent workflows benefit from:

- **Langgraph's graph-based orchestration** - Complex multi-step agent workflows are first-class citizens
- **TypeScript's type system** - Zod schemas enforce structure on AI inputs/outputs
- **Node.js async model** - Better fit for streaming AI responses and long-running agent tasks
- **LangChain ecosystem** - Tools, memory, and agent primitives

### They serve different purposes

| Rails | Langgraph |
|-------|-----------|
| Request/response web | Long-running agent tasks |
| Strong conventions | Flexible orchestration |
| Battle-tested patterns | Cutting-edge AI tooling |
| Stable, predictable | Experimental, evolving |

## Consequences

**Benefits:**
- Each service can be optimized for its purpose
- Teams can work independently on different parts
- AI orchestration can evolve rapidly without affecting core web app
- Clear separation of concerns

**Trade-offs:**
- JWT authentication adds complexity (though simpler than alternatives)
- Two services to deploy and monitor
- Shared database requires coordination on schema changes
- Cross-service debugging requires checking both logs

## How They Communicate

1. User logs into Rails (Devise)
2. Rails generates JWT with 24-hour expiry
3. Frontend stores JWT in httpOnly cookie
4. Frontend sends JWT to Langgraph in Authorization header
5. Hono middleware validates JWT and extracts user identity
6. All Langgraph resources scoped to authenticated user

## Files Involved

- `rails_app/app/controllers/concerns/authorization.rb` - JWT generation
- `langgraph_app/app/lib/server/langgraph/auth/auth.ts` - JWT validation
- `langgraph_app/app/graphs/` - Agent workflow definitions
