# State Management & Forms

Zustand stores for global/shared state, React Hook Form + Zod for form validation, React Query for server data, and Inertia page props for initial hydration. Stores use explicit selectors for minimal re-renders.

## Zustand Stores

**Directory:** `rails_app/app/javascript/frontend/stores/`

### SessionStore

**File:** `stores/sessionStore.ts`

App-global session data that persists across navigation.

| State | Type | Purpose |
|-------|------|---------|
| `currentUser` | User | Logged-in user |
| `trueUser` | User | Original user (when impersonating) |
| `impersonating` | boolean | Whether impersonation is active |
| `jwt` | string | JWT for Langgraph auth |
| `langgraphPath` | string | Langgraph API base URL |
| `rootPath` | string | Rails API base URL |

Hydrated once in SiteLayout. Never resets during navigation.

**Convenience hooks:** `useCurrentUser()`, `useJwt()`, `useLanggraphPath()`, `useRootPath()`, `useImpersonating()`

### WorkflowStore

**File:** `stores/workflowStore.ts`

URL-driven navigation state. URL is the single source of truth.

| State | Purpose |
|-------|---------|
| `page` | Current workflow page |
| `substep` | Current substep within page |
| `projectUUID` | Active project |
| `hasVisitedReview` | Enables "Return to Review" |

Factory pattern: `createWorkflowStore()` used in `WorkflowProvider`.

**Actions:** `navigate()`, `continue()`, `back()`, `setSubstep()`, `returnToReview()`

### ProjectStore

**File:** `stores/projectStore.ts`

Per-page entity IDs. Resets on URL change, then hydrates from Inertia props.

| State | Type | Purpose |
|-------|------|---------|
| `projectId` | number | Active project ID |
| `projectUUID` | string | Active project UUID |
| `websiteId` | number | Active website ID |
| `brainstormId` | number | Active brainstorm ID |
| `campaignId` | number | Active campaign ID |
| `threadId` | string | Active Langgraph thread |

**Convenience hooks:** `useProjectId()`, `useWebsiteId()`, `useBrainstormId()`, `useCampaignId()`, `useThreadId()`

### CreditStore

**File:** `stores/creditStore.ts`

Credit balance and out-of-credits state.

| State | Purpose |
|-------|---------|
| `plan_credits` | Plan credit balance |
| `pack_credits` | Pack credit balance |
| `total_credits` | Combined balance |
| `isOutOfCredits` | Whether credits are exhausted |
| `justRanOut` | Triggers exhausted modal (1-hour suppress) |
| `showLowCreditModal` | Triggers low-credit warning (24-hour suppress) |

Uses `persist` middleware for dismiss timestamps. Langgraph sends millicredits, converted to credits (1000:1).

### ChatsRegistry

**File:** `stores/chatsRegistry.ts`

Maps workflow pages to active Langgraph chat instances.

- `registerChat(page, chat)` — register with ref counting
- `unregisterChat(page)` — decrement ref count
- `getChat(page)` — get active chat
- `syncStageToChat(page, substep)` — update chat state on substep change

Uses `createStore` (not `create`) since it's accessed from outside React (WorkflowProvider effect).

### FormRegistry

**File:** `stores/formRegistry.ts`

Multi-form validation and coordinated saves across subforms.

- `register(formId, methods, getData)` — register a form
- `validate(formId)` — trigger validation
- `validateAndSave(formId, saveFn)` — validate then save if valid

### InsightsStore

**File:** `stores/insightsStore.ts`

Caches generated analytics insights to survive browser back/forward navigation.

### Form-Specific Stores

**Files:** `stores/launchFormStore.ts`, `stores/settingsFormStore.ts`

Built with `createHydratableStore<T>(defaults)` factory:
- `hydrateOnce(values)` — loads from Inertia props exactly once
- `setValues(values)` — synced from form `watch()` subscription
- Form state survives substep navigation

## Store Hydration

**File:** `rails_app/app/javascript/frontend/layouts/site-layout.tsx`

SiteLayout is the single place where Inertia props flow into stores:

```
useLayoutEffect runs on every page transition:
  1. SessionStore.hydrateFromPageProps(currentUser, jwt, langgraphPath, ...)
  2. CreditStore.hydrateFromPageProps(credits)
  3. If URL changed → ProjectStore.reset()
  4. ProjectStore.setFromPageProps(project, website, brainstorm, campaign, threadId)
```

**Key principle:** stores hydrate FROM Inertia props. Components read FROM stores, not directly from `usePage()` (except for page-specific data not worth storing).

## Selector Pattern

All stores use `subscribeWithSelector` middleware and export explicit selectors:

```typescript
// Store definition
export const useSessionStore = create<SessionStore>()(
  subscribeWithSelector((set) => ({ ... }))
);

// Selector export
export const selectJwt = (s: SessionStore) => s.jwt;

// Convenience hook
export function useJwt() {
  return useSessionStore(selectJwt);
}
```

Components use convenience hooks (not raw store access) to ensure minimal re-renders.

## React Hook Form + Zod

**Example:** `rails_app/app/javascript/frontend/components/ads/forms/settings-form/SettingsForm.tsx`

### Pattern

1. **Define schema** with Zod (`settingsForm.schema.ts`):
```typescript
export const settingsFormSchema = z.object({
  locations: z.array(locationSchema).min(1),
  budget: z.object({ dailyBudgetCents: z.number().min(100) }),
});
export type SettingsFormData = z.infer<typeof settingsFormSchema>;
```

2. **Initialize form** with zodResolver:
```typescript
const methods = useForm<SettingsFormData>({
  resolver: zodResolver(settingsFormSchema),
  mode: "onChange",
  defaultValues: values, // from form store
});
```

3. **Hydrate from Inertia** once:
```typescript
const hydrate = useEffectEvent(() => {
  const inertiaProps = transformFromApi(usePage().props);
  if (hydrateOnce(inertiaProps)) {
    methods.reset(inertiaProps);
  }
});
```

4. **Sync to store** on change:
```typescript
useEffect(() => {
  const sub = methods.watch((values) => setValues(values));
  return () => sub.unsubscribe();
}, [methods, setValues]);
```

5. **Wrap with FormProvider:**
```tsx
<FormProvider {...methods}>
  <LocationTargeting />
  <AdSchedule />
  <DailyBudget />
</FormProvider>
```

### Transform Pattern

API data ↔ form data via transform functions:
- `transformFromApi()` — API response → form defaults
- `transformToApi()` — form data → API request body

## Auto-Save

**File:** `rails_app/app/javascript/frontend/components/ads/hooks/useAutosaveCampaign.ts`

Debounced auto-save for ad campaign forms:

- 750ms debounce via `useLatestMutation` hook
- Change detection: only saves if `lastSavedValue` changed
- Error mapping: API errors mapped back to form fields via `mapApiErrorsToForm()`
- Dual modes: `mutateDebounced()` (watch-triggered) and `saveNow()` (immediate)

### useLatestMutation

**File:** `rails_app/app/javascript/frontend/hooks/useLatestMutation.ts`

Advanced mutation hook that supersedes previous requests:
- Aborts stale requests when new ones arrive
- Built-in debouncer with `cancel()` and `flush()`
- `SupersededError` for cancelled requests (not propagated to callbacks)

### useFormRegistration

**File:** `rails_app/app/javascript/frontend/hooks/useFormRegistration.ts`

Registers a form with the FormRegistry for coordinated validation:

```typescript
useFormRegistration("settings", methods, getData);
```

Parent component can then validate all registered forms before a combined save.

## React Query

**Directory:** `rails_app/app/javascript/frontend/api/`

### Service Hook Pattern

```typescript
export function useWebsiteService() {
  const jwt = useJwt();
  const rootPath = useRootPath();
  return useMemo(() => new WebsiteAPIService({ jwt, baseUrl: rootPath }), [jwt, rootPath]);
}
```

### API Hook Files

| File | Hooks |
|------|-------|
| `campaigns.hooks.ts` | `useCampaignService()`, `useAutosaveCampaign()`, `useDeployCampaign()` |
| `projects.hooks.ts` | `useProjects()`, `useDeleteProject()` |
| `websites.hooks.ts` | `useWebsite()`, `useWebsiteService()` |
| `themes.hooks.ts` | `useThemes()`, `useThemeService()` |
| `uploads.hooks.ts` | `useUploadsService()` |
| `socialLinks.hooks.ts` | `useSocialLinks()`, `useUpdateSocialLinks()` |
| `domainContext.hooks.ts` | `useDomainContext()` |

All hooks read JWT and base URL from SessionStore.

## Inertia Integration

### Initial Data

```typescript
const { campaign, location_targets } = usePage<CampaignProps>().props;
```

Inertia delivers server data as page props. Components read these for initial hydration, then switch to React Query for subsequent updates.

### Navigation

- **Cross-page:** `router.visit("/projects/uuid/website/build")` — full Inertia transition
- **Same-page:** `window.history.pushState()` — URL update only, preserves component state

### Flash Messages

Rails flash messages delivered via Inertia props, rendered as Sonner toasts in SiteLayout.

## Authentication

1. Rails generates JWT in auth controller
2. JWT delivered to frontend via Inertia page props
3. SiteLayout hydrates JWT into SessionStore
4. All API hooks read JWT via `useJwt()`
5. Chat options include `Authorization: Bearer ${jwt}` header
6. React Query service hooks create authenticated service instances

## Key Files Index

### Stores
| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/stores/sessionStore.ts` | User identity, JWT, API config |
| `rails_app/app/javascript/frontend/stores/workflowStore.ts` | URL-driven navigation |
| `rails_app/app/javascript/frontend/stores/projectStore.ts` | Per-page entity IDs |
| `rails_app/app/javascript/frontend/stores/creditStore.ts` | Credit balance, modal control |
| `rails_app/app/javascript/frontend/stores/formRegistry.ts` | Multi-form coordination |
| `rails_app/app/javascript/frontend/stores/chatsRegistry.ts` | Active chat instances |
| `rails_app/app/javascript/frontend/stores/insightsStore.ts` | Cached analytics insights |
| `rails_app/app/javascript/frontend/stores/createHydratableStore.ts` | Generic hydratable store factory |
| `rails_app/app/javascript/frontend/stores/launchFormStore.ts` | Launch form state |
| `rails_app/app/javascript/frontend/stores/settingsFormStore.ts` | Settings form state |

### Hooks
| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/hooks/useFormRegistration.ts` | Form → registry binding |
| `rails_app/app/javascript/frontend/hooks/useLatestMutation.ts` | Debounced mutations with supersede |
| `rails_app/app/javascript/frontend/hooks/useChatOptions.ts` | Shared chat config factory |
| `rails_app/app/javascript/frontend/components/ads/hooks/useAutosaveCampaign.ts` | Auto-save pattern |

### API Hooks
| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/api/index.ts` | Re-exports all hooks |
| `rails_app/app/javascript/frontend/api/campaigns.hooks.ts` | Campaign CRUD + autosave |
| `rails_app/app/javascript/frontend/api/projects.hooks.ts` | Project list, delete |
| `rails_app/app/javascript/frontend/api/websites.hooks.ts` | Website queries |
| `rails_app/app/javascript/frontend/api/themes.hooks.ts` | Theme queries |
| `rails_app/app/javascript/frontend/api/uploads.hooks.ts` | File upload service |

### Hydration
| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/layouts/site-layout.tsx` | Single hydration orchestration point |

## Related Docs

- [overview.md](./overview.md) — Frontend architecture and SiteLayout
- [components.md](./components.md) — Field compound component for form layout
- [streaming.md](./streaming.md) — Chat state management (SmartSubscription)
