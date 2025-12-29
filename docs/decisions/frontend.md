# Frontend: Decision History

> Decisions about UI framework, rendering approach, and in-browser execution. Most recent first.

---

## Current State

Inertia.js bridges Rails and React - Rails handles routing/controllers, React handles UI. Website previews run in WebContainers (in-browser Node.js). Type safety via rswag + OpenAPI → TypeScript generation.

---

## Decision Log

### 2025-12-28: Use WebContainers for In-Browser Code Execution

**Context:** Users need to see their landing page as they're building it. The AI generates React/Vite code that needs to be compiled and rendered in real-time.

**Decision:** Use WebContainers API for in-browser Node.js execution. The generated website runs entirely in the user's browser.

**Why:**

Real-time preview:
- Live preview updates as files change
- No deploy step between edit and view
- True WYSIWYG editing experience

Prior art (Bolt.new):
- StackBlitz's Bolt.new demonstrated this pattern works
- User describes what they want → AI generates code → Code runs immediately → User iterates

Cost and scaling:
| Approach | Cost Model |
|----------|------------|
| **WebContainers** | Zero server cost - runs in browser |
| Server-side Node per user | $$$ - one process per active user |
| Pre-rendered static | Can't show live edits |
| Docker containers | Expensive to spin up/down |

Security:
- Browser sandbox provides isolation
- User code can't access server filesystem
- Each user's code isolated from others

**Trade-offs:**
- Requires modern browser with WebContainer support
- First load is slower (downloads Node.js runtime)
- Memory usage in browser can be significant
- Debugging can be tricky (browser-in-browser)

**Status:** Current

---

### 2025-12-28: Use Inertia.js + React Instead of API + SPA

**Context:** We need a modern, interactive frontend but don't want to build and maintain a separate API layer.

**Decision:** Use Inertia.js to bridge Rails and React - getting the best of both worlds.

**Why:**

Rails side keeps:
- Controllers handle requests
- Models manage data
- Routes define URLs
- Authentication via Devise
- Background jobs via Sidekiq

React side gets:
- Component-based UI
- Rich interactivity
- Modern tooling (Vite, TypeScript)
- Ecosystem of libraries

What we avoid:
- No API versioning headaches
- No serializer/deserializer duplication
- No CORS configuration
- No separate deployment for API
- No authentication complexity between frontend/backend

How it works:
```
Rails Controller → render inertia: 'Projects/Show', props: { project: @project }
                          ↓
Browser → React component receives props as JSON
```

Type safety via:
```
Ruby Schema Files → OpenAPI YAML → TypeScript Types → React Components
```

**Trade-offs:**
- Inertia is less common than REST API + SPA
- Some learning curve for the Inertia model
- Can't easily have mobile app hit same backend (would need API anyway)
- Props must be serializable

**Status:** Current

---

## Files Involved

- `rails_app/config/initializers/inertia_rails.rb` - Inertia configuration
- `rails_app/app/controllers/` - Controllers render Inertia pages
- `rails_app/app/javascript/frontend/` - React components + WebContainer integration
- `spec/support/schemas/inertia/` - Ruby schemas for props
- `rails_app/templates/` - Template structure for websites
- `rails_app/.claude/skills/inertia-props-types.md` - Full props guide
