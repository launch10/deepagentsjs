# Architecture: Decision History

> Decisions about service boundaries, system design, and infrastructure. Most recent first.

---

## Current State

Two-service architecture: Rails (web app) + Langgraph (AI engine). They share PostgreSQL but communicate via JWT-authenticated API calls. Each service optimized for its purpose.

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

---

## Decision Log

### 2025-12-28: Separate Rails and Langgraph Services

**Context:** Launch10 needs both traditional web capabilities (auth, payments, CRUD) and AI-powered agent workflows (brainstorming, page generation, ads). These have fundamentally different characteristics.

**Decision:** Run Langgraph as a separate TypeScript/Node.js service communicating with Rails via JWT.

**Why:**

Rails is better for web standards:
- Significantly more opinionated = agents make canonically correct decisions
- RESTful routing, ActiveRecord, Devise, Sidekiq
- Agent doesn't have to guess "how should I structure this?" - Rails already decided

Langgraph/TypeScript is better for AI orchestration:
- Graph-based orchestration for complex multi-step workflows
- TypeScript + Zod enforce structure on AI inputs/outputs
- Node.js async model fits streaming AI responses
- LangChain ecosystem for tools, memory, agent primitives

**Trade-offs:**
- Two services to deploy and monitor
- JWT authentication adds complexity (though simpler than alternatives)
- Cross-service debugging requires checking both logs
- Shared database requires coordination on schema changes

**Status:** Current

---

## Files Involved

- `rails_app/` - Rails application
- `langgraph_app/` - Langgraph service
- `rails_app/app/controllers/concerns/authorization.rb` - JWT generation
- `langgraph_app/app/lib/server/langgraph/auth/auth.ts` - JWT validation
