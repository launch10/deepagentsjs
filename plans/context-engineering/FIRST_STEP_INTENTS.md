# First Step: Intent-Triggered Actions (Theme & Images)

## Goal

Validate the intent pattern with a focused use case: theme changes and image uploads in the website builder. This establishes:

1. **Intent as the trigger** - No user message needed
2. **Single source of truth** - All file changes flow through Langgraph
3. **Entry node routing** - Website graph routes based on intent

## Architecture Decision

**Now:** Add intent router to website graph (Option A)
**Later:** If pattern works, refactor to single router with subgraphs (Option B)

```
NOW (Option A):                          LATER (Option B):
─────────────────                        ──────────────────
Frontend → Website Graph                 Frontend → Intent Router
           ├─ intent router                         ├─ website subgraph
           ├─ theme handler                         ├─ brainstorm subgraph
           └─ conversation                          └─ ads subgraph

Frontend → Brainstorm Graph              (Frontend hints domain:
           └─ ...                         "I'm on website page")
```

Option B is cleaner but bigger refactor. Start with A, validate, migrate later.

---

## The Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ User clicks theme "Seafoam" in ThemeSelector (on Website page)       │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Frontend (ThemeSelector component)                                    │
│ • Component receives onSelect prop from parent                        │
│ • On Website page: onSelect calls Langgraph with intent              │
│ • On Brainstorm page: onSelect calls Rails API directly              │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Langgraph: Router (routeFromStart) - FIRST                           │
│ if (state.intent?.type === 'change-theme') → themeHandler           │
│ else → normalConversationFlow                                        │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Middleware (context engineering) - if needed                         │
│ • Injects context message if agent subscribes to intent type         │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Theme Handler Node                                                    │
│ 1. Call Rails API: PATCH /websites/:id { theme_id: 5 }              │
│ 2. Rails updates theme + regenerates index.css                       │
│ 3. Fetch updated files from Rails                                    │
│ 4. Clear intent, return files to frontend                            │
└──────────────────────────────────────────────────────────────────────┘
```

## First Implementation: change-theme

**Scope:** Just `change-theme` intent, TDD approach.

**Frontend:**
- ThemeSelector component takes `onSelect: (themeId: number) => void` prop
- Parent (WebsiteBuilder) passes handler that invokes Langgraph with intent
- Parent (BrainstormPage) passes handler that calls Rails API directly

**Langgraph:**
- Add `intent` to BaseAnnotation
- Update `routeFromStart` to check intent
- Create `themeHandler` node that calls Rails API
- Wire up edges

---

## Implementation Steps

### Step 1: Core Intent Types (Shared)

Intent lives in the shared types so both frontend and Langgraph can use it.

**File: `shared/types/intent.ts`** (NEW)

```typescript
import { z } from "zod";

// Base intent schema - all intents have type, payload, and timestamp
export const baseIntentSchema = z.object({
  type: z.string(),
  payload: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
});

export type BaseIntent = z.infer<typeof baseIntentSchema>;

// Domain-specific intent types
export const websiteIntentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("change-theme"),
    payload: z.object({ themeId: z.number() }),
    createdAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal("upload-images"),
    payload: z.object({ fileIds: z.array(z.number()) }),
    createdAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal("delete-image"),
    payload: z.object({ imageId: z.number() }),
    createdAt: z.string().datetime(),
  }),
]);

export const brainstormIntentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("skip-topic"),
    payload: z.object({ topic: z.string() }),
    createdAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal("do-the-rest"),
    payload: z.object({}),
    createdAt: z.string().datetime(),
  }),
]);

export const navigationIntentSchema = z.object({
  type: z.literal("navigate"),
  payload: z.object({
    page: z.string(),
    path: z.string(),
  }),
  createdAt: z.string().datetime(),
});

// Union of all intent types
export const intentSchema = z.union([
  websiteIntentSchema,
  brainstormIntentSchema,
  navigationIntentSchema,
  baseIntentSchema, // Fallback for unknown intents
]);

export type Intent = z.infer<typeof intentSchema>;
export type WebsiteIntent = z.infer<typeof websiteIntentSchema>;
export type BrainstormIntent = z.infer<typeof brainstormIntentSchema>;
export type NavigationIntent = z.infer<typeof navigationIntentSchema>;
```

**File: `shared/types/index.ts`** (ADD EXPORT)

```typescript
// Add to existing exports
export * as Intent from "./intent";
export * from "./intent";
```

### Step 2: Add Intent to BaseAnnotation (Core Layer)

**File: `langgraph_app/app/annotation/base.ts`** (MODIFY)

```typescript
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { ErrorStateType, BaseMessage, PrimaryKeyType, ThreadIDType, CreditStatus, Intent } from "@types";

export const BaseAnnotation = Annotation.Root({
  // ... existing fields ...

  // Intent: user action that triggered this graph invocation
  // Consumed after handling (cleared by handler nodes)
  intent: Annotation<Intent | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),
});
```

Now ALL graphs (website, brainstorm, ads, deploy, insights) automatically have `intent` in their state.

### Step 3: Intent Infrastructure (Frontend)

**File: `rails_app/app/javascript/frontend/lib/intent.ts`** (NEW)

```typescript
import type { Intent } from "@shared/types/intent";

const INTENT_KEY = 'launch10_pending_intent';
const INTENT_EXPIRY_MS = 30 * 1000; // 30 seconds

export function stashIntent(intent: Omit<Intent, 'createdAt'>): void {
  localStorage.setItem(INTENT_KEY, JSON.stringify({
    ...intent,
    createdAt: new Date().toISOString(),
  }));
}

export function consumeIntent(): Intent | null {
  const raw = localStorage.getItem(INTENT_KEY);
  if (!raw) return null;
  localStorage.removeItem(INTENT_KEY);

  const intent = JSON.parse(raw) as Intent;
  // Expire after 30 seconds (intents should be consumed quickly)
  if (Date.now() - new Date(intent.createdAt).getTime() > INTENT_EXPIRY_MS) {
    return null;
  }
  return intent;
}

export function peekIntent(): Intent | null {
  const raw = localStorage.getItem(INTENT_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as Intent;
}

export function clearIntent(): void {
  localStorage.removeItem(INTENT_KEY);
}
```

### Step 4: Invoke Graph with Intent

**Where the intent gets into graph state:**

```typescript
// frontend/hooks/useChat.ts or wherever graph is invoked

async function invokeWithIntent(intent: Omit<Intent, 'createdAt'>) {
  // Stash intent first (in case of redirect)
  stashIntent(intent);

  // Invoke the graph with intent in initial state
  await invokeGraph({
    projectId,
    threadId,
    intent: consumeIntent(), // Consume it as we invoke
    // No user message needed for intent-only invocations
  });
}

// Usage in theme selector
function onThemeSelect(themeId: number) {
  invokeWithIntent({
    type: 'change-theme',
    payload: { themeId },
  });
}
```

### Step 5: Update Router (routeFromStart)

**File: `langgraph_app/app/graphs/website.ts`**

The website graph already has `routeFromStart` that routes based on `command`. We extend it to also check `intent`:

```typescript
const routeFromStart = (state: WebsiteGraphState): string => {
  // Check intent first (new)
  if (state.intent) {
    switch (state.intent.type) {
      case 'change-theme':
        return 'themeHandler';
      case 'upload-images':
      case 'delete-image':
        return 'imageHandler';
      // Unknown intents fall through to existing logic
    }
  }

  // Existing routing logic
  if (isCacheModeEnabled()) {
    return 'cacheMode';
  }
  if (state.command === 'improve_copy') {
    return 'improveCopy';
  }
  return 'buildContext';
};
```

### Step 6: Theme Handler Node

**File: `langgraph_app/app/nodes/website/themeHandler.ts`**

Following the existing node pattern with `NodeMiddleware`:

```typescript
import { NodeMiddleware } from '@middleware/node';
import { WebsiteGraphState } from '@annotation/websiteAnnotation';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { RailsAPI } from '@rails_api';

export const themeHandler = NodeMiddleware.use(
  {},
  async (
    state: WebsiteGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    const { intent, websiteId, jwt } = state;

    if (intent?.type !== 'change-theme') {
      throw new Error('themeHandler called without change-theme intent');
    }

    const { themeId } = intent.payload;

    // Call Rails to update theme (updates index.css)
    const api = new RailsAPI({ jwt });
    const updatedWebsite = await api.websites.update(websiteId, {
      theme_id: themeId,
    });

    // Return updated files - same shape as syncFilesNode
    return {
      intent: undefined, // Clear intent after handling
      files: updatedWebsite.code_files,
      status: 'completed',
    };
  }
);
```

### Step 7: Wire Up Graph

**File: `langgraph_app/app/graphs/website.ts`**

Add the new nodes and edges:

```typescript
import { themeHandler } from '@nodes/website/themeHandler';
import { imageHandler } from '@nodes/website/imageHandler';

// Add nodes
websiteGraph
  .addNode('themeHandler', themeHandler)
  .addNode('imageHandler', imageHandler)
  // ... existing nodes

// Update conditional edges from START
  .addConditionalEdges(START, routeFromStart, {
    themeHandler: 'themeHandler',
    imageHandler: 'imageHandler',
    cacheMode: 'cacheMode',
    improveCopy: 'improveCopy',
    buildContext: 'buildContext',
  })

// Intent handlers go directly to cleanup
  .addEdge('themeHandler', 'cleanupFilesystem')
  .addEdge('imageHandler', 'cleanupFilesystem')
```

**Note:** Intent handlers follow the same path as other nodes: `handler → cleanupFilesystem → syncFiles → cleanupState → END`. This ensures files are synced properly.

---

## What This Validates

1. **Intent storage** - localStorage survives any redirects
2. **Intent-only invocation** - Graph runs without user message
3. **Entry node routing** - Pattern for handling different intents
4. **Silent actions** - Actions that don't need conversational response
5. **Single source of truth** - Files only come from Langgraph

---

## Testing Checklist

- [ ] Click theme → theme changes → no chat message appears
- [ ] Files are updated (check index.css has new theme)
- [ ] Intent is consumed after handling (localStorage cleared)
- [ ] Expired intent (>30s) is ignored
- [ ] Unknown intent falls through to conversation
- [ ] Can still have normal conversation after intent action

---

## Next Steps After This Works

1. **Add image intents** - Same pattern for upload/delete
2. **Add Events layer** - Record theme changes as events (for context)
3. **Expand to other graphs** - Brainstorm actions, Ads actions
4. **Add Memory layer** - Cross-conversation context

---

## Decisions Made

1. **Response format** - Same as normal graph responses. Backend decides what changes.
2. **Optimistic UI** - Wait for response, don't update optimistically.

## Open Questions

1. **Error handling** - What happens if Rails API fails during intent action?
2. **Streaming** - Do intent actions stream or return immediately?

---

## Future: Option B Architecture (Single Router)

When/if we migrate to a unified router, the architecture would look like:

```typescript
// One graph to rule them all
const mainRouter = new StateGraph(RouterAnnotation)
  .addNode('router', routerNode)
  .addNode('website', websiteSubgraph)
  .addNode('brainstorm', brainstormSubgraph)
  .addNode('ads', adsSubgraph)
  .addConditionalEdges('router', routeByDomainAndIntent, {
    website: 'website',
    brainstorm: 'brainstorm',
    ads: 'ads',
  });

// Frontend always calls same endpoint
POST /api/chat/stream
{
  threadId: "...",
  domain: "website",  // Frontend hints which page they're on
  intent: { type: "change-theme", payload: { themeId: 5 } },
  message: ""  // Optional
}
```

**Benefits:**
- Single entry point for all AI interactions
- Cross-cutting concerns (auth, credits, logging) in one place
- Easier to add new graphs
- Frontend doesn't need different hooks per graph

**When to migrate:**
- After intent pattern is validated with Option A
- When we have 3+ graphs with similar intent routing
- When cross-cutting concerns become painful to maintain
