# Frontend: Decision History

> Decisions about UI framework, rendering approach, and in-browser execution. Most recent first.

---

## Current State

Inertia.js bridges Rails and React - Rails handles routing/controllers, React handles UI. Website previews run in WebContainers (in-browser Node.js). Type safety via rswag + OpenAPI → TypeScript generation.
The frontend uses compound components, Zustand stores with clear boundaries, and React Testing Library for testing. All decisions below inform this architecture.

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

### 2025-12-28: Compound Components Over Boolean Props

**Context:** Building the Brainstorm chat UI required flexible message rendering across different contexts (with/without bubbles, active/inactive states, loading states). Initial approaches with boolean props led to combinatorial explosion.

**Decision:** Use compound component pattern (`AIMessage.Content`, `AIMessage.Bubble`, `AIMessage.Loading`) instead of prop-based rendering (`<AIMessage isLoading hasBubble isActive />`).

**Why:**

- Boolean props create exponential combinations as features grow
- Compound components make intent explicit in JSX
- Easier to compose differently per context without new props
- CSS class logic stays local to each sub-component

**Example:**

```tsx
// Compound pattern - clear intent, flexible
<AIMessage.Bubble>
  <AIMessage.Content state="active">Hello</AIMessage.Content>
</AIMessage.Bubble>

// Boolean pattern - obscure, rigid
<AIMessage hasBubble isActive content="Hello" />
```

**Files establishing pattern:**

- `rails_app/app/javascript/frontend/components/chat/AIMessage/index.tsx`
- `rails_app/app/javascript/frontend/components/chat/Input/index.tsx`
- `rails_app/app/javascript/frontend/components/chat/MessageList/index.tsx`

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

### 2025-12-28: Storybook Stories for All Components

**Context:** Need visual regression detection, isolated development environment, and living documentation for the component library.

**Decision:** Every component must have a corresponding `.stories.tsx` file with variants for all key states.

**Why:**

- Visual regression detection before code review
- Isolated development sandbox (faster iteration)
- Auto-generated documentation
- Design system reference for designers and developers

**Files establishing pattern:**

- `rails_app/stories/chat/AIMessage.stories.tsx`
- `rails_app/stories/chat/Input.stories.tsx`
- `rails_app/stories/chat/MessageList.stories.tsx`

**Status:** Current

---

## Files Involved

- `rails_app/config/initializers/inertia_rails.rb` - Inertia configuration
- `rails_app/app/controllers/` - Controllers render Inertia pages
- `rails_app/app/javascript/frontend/` - React components + WebContainer integration
- `spec/support/schemas/inertia/` - Ruby schemas for props
- `rails_app/templates/` - Template structure for websites
- `rails_app/.claude/skills/inertia-props-types.md` - Full props guide

### 2025-12-28: Separate Graph State from Rails Data

**Context:** Brainstorm UI receives data from two sources: Inertia props (Rails/persistent) and Langgraph state (ephemeral). Mixing these caused confusion about source of truth and stale data bugs.

**Decision:** Store structure explicitly separates `routing` (connection details), `brainstorm` (graph state + project metadata), and `ui` (local-only state). Never mix graph state mutations with Rails data.

**Why:**

- Clear responsibility boundaries
- Prevents stale data issues
- Makes caching easier
- Simplifies debugging (know where data came from)

**Pattern:**

```typescript
type BrainstormStoreState = {
  routing: RoutingState; // From Inertia (doesn't change)
  brainstorm: {
    project?: ProjectMetadata; // From Rails (persisted)
    memories: Memories; // From graph (ephemeral)
  };
  ui: UIState; // Local only
};
```

**Files establishing pattern:**

- `rails_app/app/javascript/frontend/stores/brainstormStore.ts`
- `rails_app/app/javascript/frontend/components/brainstorm/BrainstormHydrator.tsx`

**Status:** Current

---

### 2025-12-28: ESLint Rules for Pattern Enforcement

**Context:** Compound component patterns and store discipline require enforcement to prevent regression. Manual code review alone is insufficient.

**Decision:** Custom ESLint rules enforce: max 2 boolean props per component, max complexity 8, no direct store mutations outside store files.

**Why:**

- Catches regressions early in development
- Documents expectations in code (not just docs)
- Reduces code review burden
- Prevents gradual pattern erosion

**File:**

- `rails_app/.eslintrc.component-patterns.js`

**Status:** Current

---

## Superseded Decisions

(None yet - these are initial decisions)
