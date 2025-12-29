# Why Inertia.js + React Instead of API + SPA

## The Problem

We need a modern, interactive frontend but don't want to build and maintain a separate API layer.

## The Decision

Use Inertia.js to bridge Rails and React - getting the best of both worlds.

## Best of Both Worlds

### Rails Side

Keep everything Rails is good at:
- Controllers handle requests
- Models manage data
- Routes define URLs
- Authentication via Devise
- Background jobs via Sidekiq

### React Side

Get everything React is good at:
- Component-based UI
- Rich interactivity
- Modern tooling (Vite, TypeScript)
- Ecosystem of libraries

### What We Avoid

No separate API layer means:
- No API versioning headaches
- No serializer/deserializer duplication
- No CORS configuration
- No separate deployment for API
- No authentication complexity between frontend/backend

## How Inertia Works

```
┌─────────────────────────────────────────────────┐
│                   Rails Server                   │
│                                                  │
│  Controller                                      │
│  ┌────────────────────────────────────────────┐ │
│  │ def show                                   │ │
│  │   render inertia: 'Projects/Show',         │ │
│  │          props: { project: @project }      │ │
│  │ end                                        │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │ Props as JSON
                       ▼
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│  React Component                                 │
│  ┌────────────────────────────────────────────┐ │
│  │ function Show({ project }) {               │ │
│  │   return <div>{project.name}</div>         │ │
│  │ }                                          │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

1. User navigates to `/projects/123`
2. Rails controller runs, prepares data
3. Data passed as props to React component
4. React renders the page
5. Subsequent navigation is SPA-like (no full page reload)

## Type Safety: rswag + OpenAPI

We maintain type safety between Rails and React:

```
Ruby Schema Files (spec/support/schemas/inertia/)
         │
         ▼
   OpenAPI YAML (swagger/v1/inertia-props.yaml)
         │
         ▼
   TypeScript Types (shared/lib/api/generated/inertia-props.ts)
         │
         ▼
   React Components with typed props
```

Run `bundle exec rake inertia:generate` to regenerate types after changing Ruby schemas.

## Consequences

**Benefits:**
- One codebase, one deployment
- Full Rails conventions (routing, controllers, sessions)
- Full React capabilities (components, hooks, state)
- Type-safe props from Ruby to TypeScript
- No API maintenance burden

**Trade-offs:**
- Inertia is less common than REST API + SPA
- Some learning curve for the Inertia model
- Can't easily have mobile app hit same backend (would need API anyway)
- Props must be serializable (no passing Ruby objects directly)

## Files Involved

- `rails_app/config/initializers/inertia_rails.rb` - Inertia configuration
- `rails_app/app/controllers/` - Controllers render Inertia pages
- `rails_app/app/javascript/frontend/` - React components
- `spec/support/schemas/inertia/` - Ruby schemas for props
- `rails_app/.claude/skills/inertia-props-types.md` - Full guide
