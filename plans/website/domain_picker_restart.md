# Domain Picker: Restart Plan

## Status: IMPLEMENTED + ENHANCED

This plan has been implemented and enhanced with additional improvements.

## What Was Done

### Core Implementation
1. ✅ Created shared types at `shared/types/website/domainRecommendations.ts`
2. ✅ Added `domainRecommendations` to `WebsiteAnnotation` and shared state
3. ✅ Created graph node at `langgraph_app/app/nodes/website/domainRecommendations.ts`
4. ✅ Added node to website graph (parallel with websiteBuilder)
5. ✅ Deleted standalone service/route files
6. ✅ Simplified frontend hooks
7. ✅ Updated SubdomainPicker to use `useWebsiteChatState("domainRecommendations")`
8. ✅ Updated frontend tests (12 tests passing)

### Enhancements (Round 2)
9. ✅ **10→check→pick3 flow**: LLM generates 10 suggestions → Rails API checks availability → LLM picks top 3 from available ones
10. ✅ **Prompts module**: Extracted prompts to `langgraph_app/app/prompts/website/domainRecommendations.ts`
11. ✅ **withStructuredResponse**: Replaced raw JSON parsing with `@utils` utility
12. ✅ **Node unit tests**: Created comprehensive tests (17 tests) at `langgraph_app/tests/tests/nodes/website/domainRecommendations.test.ts`
13. ✅ **Observability**: Added logging for all key decision points and error conditions

## Original Problem

The `website-quick-actions` branch diverged from the original plan. Built a standalone HTTP endpoint instead of a graph node.

## What Was Kept

| File | Status |
|------|--------|
| `rails_app/app/controllers/api/v1/context_controller.rb` | Kept as-is |
| `rails_app/app/javascript/frontend/components/website/subdomain-picker/SubdomainPicker.tsx` | Updated data source |
| `shared/lib/api/services/domainContextAPIService.ts` | Kept |

## What Was Deleted

| File | Reason |
|------|--------|
| `langgraph_app/app/server/routes/domains.ts` | Wrong architecture |
| `langgraph_app/app/services/domains/domainRecommendationsService.ts` | Moved logic into graph node |
| `langgraph_app/app/services/domains/index.ts` | Not needed |
| `langgraph_app/tests/tests/services/domains/` | Old service tests |

---

## Step-by-Step Plan

### Step 1: Create shared types

Create `shared/types/website/domainRecommendations.ts`:

```typescript
export interface DomainRecommendation {
  domain: string;
  subdomain: string;
  score: number;
  reasoning: string;
  source: "existing" | "generated";
  availability?: "available" | "unavailable";
}

export interface DomainRecommendations {
  state: "no_existing_sites" | "existing_recommended" | "new_recommended" | "out_of_credits_no_match";
  recommendations: DomainRecommendation[];
  top_recommendation: DomainRecommendation | null;
}
```

Export from `shared/types/index.ts`.

---

### Step 2: Add to WebsiteAnnotation

In `langgraph_app/app/annotation/websiteAnnotation.ts`, add:

```typescript
domainRecommendations: Annotation<Website.DomainRecommendations | undefined>({
  default: () => undefined,
  reducer: (current, next) => next ?? current,
}),
```

---

### Step 3: Create graph node

Create `langgraph_app/app/nodes/website/domainRecommendations.ts`:

1. Copy the logic from `DomainRecommendationsService.getRecommendations()`
2. Make it idempotent: return `{}` if `state.domainRecommendations` exists
3. Use `state.brainstorm` for context (already available from `buildContext`)
4. Return `{ domainRecommendations: result }`

Export from `langgraph_app/app/nodes/index.ts`.

---

### Step 4: Add node to website graph

In `langgraph_app/app/graphs/website.ts`:

```typescript
import { domainRecommendationsNode } from "@nodes";

// Add node
.addNode("domainRecommendations", domainRecommendationsNode)

// Add edges (parallel with websiteBuilder)
.addEdge("buildContext", "domainRecommendations")
.addEdge("domainRecommendations", "cleanupFilesystem")
```

---

### Step 5: Delete standalone service/route

1. Delete `langgraph_app/app/server/routes/domains.ts`
2. Delete `langgraph_app/app/services/domains/domainRecommendationsService.ts`
3. Delete `langgraph_app/app/services/domains/index.ts`
4. Remove domains import from `langgraph_app/app/server/routes/index.ts`
5. Remove domains export from `langgraph_app/app/services/index.ts`

---

### Step 6: Simplify frontend hooks

In `rails_app/app/javascript/frontend/api/domainContext.hooks.ts`:

1. Delete `useDomainRecommendations()`
2. Delete `useDomainRecommendationsWithContext()`
3. Keep only `useDomainContext()` for Rails API data

---

### Step 7: Update SubdomainPicker

In `SubdomainPicker.tsx`:

```typescript
// Before (wrong)
const { context, recommendations } = useDomainRecommendationsWithContext(websiteId);

// After (correct)
import { useWebsiteChat } from "~/components/website/hooks/useWebsiteChat";

const { data: context } = useDomainContext(websiteId);
const { state } = useWebsiteChat();
const recommendations = state?.domainRecommendations;
```

---

### Step 8: Test

1. Create a new website via chat
2. Verify `domainRecommendations` appears in graph state
3. Verify SubdomainPicker displays recommendations
4. Verify recommendations are idempotent (same on page reload)

---

## Verification Checklist

- [x] No HTTP calls to `/api/domains/recommendations`
- [x] Recommendations come from `useWebsiteChat().state.domainRecommendations`
- [x] Graph runs `domainRecommendations` node in parallel with `websiteBuilder`
- [x] Node is idempotent (check for existing state before LLM call)
- [x] Rails `domain_context` API still provides credits + existing domains

## Test Coverage

| Test Suite | Count | Status |
|------------|-------|--------|
| Node unit tests (`domainRecommendations.test.ts`) | 17 | ✅ All passing |
| Frontend tests (`SubdomainPicker.test.tsx`) | 12 | ✅ All passing |

## Architecture Summary

```
┌──────────────────────────────────────────────────────────────────────┐
│                          WEBSITE GRAPH                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   buildContext ──┬──> websiteBuilder ────────────────┐               │
│                  │                                    │               │
│                  └──> domainRecommendations ─────────┴──> cleanup    │
│                       │                                               │
│                       ├── 1. Score existing domains (LLM)            │
│                       ├── 2. Generate 10 suggestions (LLM)           │
│                       ├── 3. Check availability (Rails API)          │
│                       └── 4. Select top 3 (LLM)                      │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘

Frontend reads: useWebsiteChatState("domainRecommendations")
```
