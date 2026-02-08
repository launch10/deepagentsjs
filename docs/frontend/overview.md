# Frontend Architecture Overview

Rails 8 + Inertia.js + React + Vite stack. Inertia handles page routing and server-side props; React renders the UI; Vite provides HMR and bundling.

## Directory Structure

```
rails_app/app/javascript/frontend/
├── api/          # React Query hooks (campaigns, projects, websites, themes, uploads, etc.)
├── components/   # Feature-organized React components
│   ├── ads/         # Ad campaign forms, workflow panel, chat
│   ├── auth/        # Sign-in, sign-up
│   ├── brainstorm/  # Brainstorm chat, brand panel
│   ├── credits/     # Credit warning modal
│   ├── deploy/      # Deploy status UI
│   ├── leads/       # Lead capture
│   ├── navigation/  # AppSidebar, AdminSidebar
│   ├── projects/    # Project list, creation
│   ├── quick-actions/ # Quick action components
│   ├── settings/    # Account settings forms
│   ├── shared/      # Chat compound components, header, pagination footer
│   ├── support/     # Help center, contact form
│   ├── ui/          # 35+ shadcn/ui primitives (buttons, inputs, dialogs, etc.)
│   └── website/     # Website builder (sidebar, preview, domain picker, steps)
├── context/      # React context providers (WorkflowProvider)
├── helpers/      # Utility functions (clipboard, formatting, error mapping)
├── hooks/        # Custom hooks (chat options, debounce, DNS, website preview)
├── layouts/      # SiteLayout (root wrapper)
├── lib/          # Shared utilities, constants, validation, WebContainer manager
├── pages/        # Inertia page components (one per route)
├── stores/       # Zustand state stores
├── styles/       # SCSS (animations, variables, z-index)
├── test/         # Test utilities and fixtures
└── types/        # TypeScript type definitions
```

## Inertia Bootstrap

**File:** `rails_app/app/javascript/entrypoints/inertia.ts`

`createInertiaApp()` initializes the React SPA:

1. **Page resolution** — `import.meta.glob("../frontend/pages/**/*.tsx", { eager: true })` eagerly loads all page components at build time
2. **Layout auto-wrap** — Every page defaults to `SiteLayout` unless it defines a custom `.layout` property
3. **Title formatting** — Appends "- Launch10" to page titles
4. **Progress indicator** — Shows spinner during Inertia page transitions

## SiteLayout

**File:** `rails_app/app/javascript/frontend/layouts/site-layout.tsx`

Root wrapper that sets up the entire app infrastructure:

```
QueryClientProvider (React Query)
  └─ WorkflowProvider (workflow context)
       ├─ AppSidebar (left nav)
       ├─ Header (top bar with progress stepper)
       ├─ {children} (page content)
       ├─ Toaster (Sonner notifications)
       └─ CreditWarningModal (low/exhausted credits)
```

**Store hydration** happens in `useLayoutEffect`:
- **SessionStore** — user identity, JWT, langgraph_path, root_path
- **CreditStore** — credit balance from Inertia props
- **ProjectStore** — resets on URL change, then hydrates project/website/brainstorm/campaign IDs

**Background tasks:**
- WebContainer warmup (eager boot for website builder)
- Scroll-to-top on route change
- Flash message toasts from Rails

## Page Components

**Directory:** `rails_app/app/javascript/frontend/pages/`

| Page Component | Route Pattern | Purpose |
|----------------|---------------|---------|
| `Dashboard.tsx` | `/dashboard` | Analytics, performance charts, project list |
| `Projects.tsx` | `/projects` | Project directory and creation |
| `Brainstorm.tsx` | `/projects/:uuid/brainstorm` | Brainstorm chat with brand personalization |
| `Website.tsx` | `/projects/:uuid/website/:substep` | Landing page builder (build/domain/deploy) |
| `Campaign.tsx` | `/projects/:uuid/campaigns/:substep` | Ad campaign (content/highlights/keywords/settings/launch/review) |
| `Deploy.tsx` | `/projects/:uuid/deploy` | Final deployment |
| `Settings.tsx` | `/settings` | Account settings |
| `Support.tsx` | `/support` | Help center |
| `Auth/SignIn.tsx` | `/auth/sign-in` | Authentication |
| `Madmin/*.tsx` | `/madmin/*` | Admin dashboard |

Pages use RSwag-generated types for type-safe props: `usePage<DashboardProps>().props`.

## Routing

**Two navigation modes:**

1. **Cross-page** (Inertia `router.visit()`) — swaps the entire page component, triggers full lifecycle, resets ProjectStore
2. **Same-page substep** (`window.history.pushState()`) — updates URL without reloading, preserves component state (form inputs, etc.)

WorkflowStore decides which mode to use:
- Different page → `router.visit(buildUrl(page, substep, uuid))`
- Same page, different substep → `pushState` + store update

**URL patterns:**
```
/projects/{uuid}/brainstorm           — no substeps
/projects/{uuid}/website/{substep}    — build | domain | deploy
/projects/{uuid}/campaigns/{substep}  — content | highlights | keywords | settings | launch | review
/projects/{uuid}/deploy               — no substeps
```

## WorkflowProvider

**Files:**
- `rails_app/app/javascript/frontend/context/WorkflowProvider.tsx`
- `rails_app/app/javascript/frontend/stores/workflowStore.ts`

URL is the single source of truth. The store syncs FROM the URL, not the other way around.

**State:**
- `page` — current workflow page ("brainstorm" | "website" | "ad_campaign" | "deploy")
- `substep` — current substep within page
- `projectUUID` — active project
- `hasVisitedReview` — enables "Return to Review" button

**Sync triggers:**
- On mount — `syncFromUrl()` extracts state from `window.location.pathname`
- On `popstate` (browser back/forward) — re-parses URL
- On `router.on("navigate")` (Inertia transition) — re-parses URL

**Actions:** `navigate()`, `continue()`, `back()`, `setSubstep()`, `returnToReview()`

**Substep routing example** (Website page):
```
Website.tsx → <WebsiteStep />
  ↓ reads substep from WorkflowStore
  ↓ renders matching component
  STEPS = { build: BuildStep, domain: DomainStep, deploy: DeployStep }
```

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/javascript/entrypoints/inertia.ts` | Inertia app init, page resolver, layout auto-wrap |
| `rails_app/app/javascript/frontend/layouts/site-layout.tsx` | Root provider stack, store hydration, flash messages |
| `rails_app/app/javascript/frontend/context/WorkflowProvider.tsx` | Workflow context, URL sync triggers |
| `rails_app/app/javascript/frontend/stores/workflowStore.ts` | URL-as-truth state, navigation logic, URL parsing |
| `rails_app/app/javascript/frontend/stores/projectStore.ts` | Per-page project/website/brainstorm/campaign IDs |
| `rails_app/app/javascript/frontend/stores/sessionStore.ts` | User identity, JWT, API config |
| `rails_app/app/javascript/frontend/lib/workflowNavigation.ts` | Pure workflow transition functions |
| `rails_app/app/javascript/frontend/pages/*.tsx` | Top-level page components |
| `rails_app/app/javascript/frontend/components/website/steps/index.tsx` | Website substep router |

## Related Docs

- [components.md](./components.md) — UI design system and component patterns
- [streaming.md](./streaming.md) — Real-time streaming and chat UI
- [website-builder-ui.md](./website-builder-ui.md) — Website builder frontend
- [forms-and-state.md](./forms-and-state.md) — State management and forms
