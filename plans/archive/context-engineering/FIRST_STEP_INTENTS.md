# Intent-Routed Graphs

## Overview

Intents are structured user actions that trigger specific graph flows without requiring a conversational message. The pattern uses a factory function (`createIntentGraph`) to build graphs that route based on `state.intent?.type`.

**Key principles:**
1. **Intent as the trigger** - No user message needed for intent-only invocations
2. **Subgraph isolation** - Each intent maps to a self-contained subgraph
3. **Automatic cleanup** - Intent is cleared after the subgraph completes
4. **Type-safe routing** - TypeScript generics ensure valid intent types

---

## Architecture

```
Frontend invokes graph with intent
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ createIntentGraph routes by state.intent?.type              │
│                                                             │
│   intent.type === "change_theme" → themeHandlerSubgraph     │
│   intent.type === "improve_copy" → improveCopySubgraph      │
│   no intent / unknown            → defaultSubgraph          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Subgraph executes (self-contained flow)                     │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ clearIntent node (automatic)                                │
│ Sets state.intent = undefined                               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
        END
```

---

## Implementation

### 1. Intent Types (`shared/types/intent.ts`)

Intents are Zod schemas with `type`, `payload`, and `createdAt`. Each domain (website, brainstorm) has its own discriminated union.

```typescript
// Website intents
export const changeThemeIntentSchema = z.object({
  type: z.literal("change_theme"),
  payload: z.object({ themeId: z.number() }),
  createdAt: z.string(),
});

export const improveCopyIntentSchema = z.object({
  type: z.literal("improve_copy"),
  payload: z.object({ style: z.string().optional() }),
  createdAt: z.string(),
});

export const websiteIntentSchema = z.discriminatedUnion("type", [
  changeThemeIntentSchema,
  uploadImagesIntentSchema,
  deleteImageIntentSchema,
  improveCopyIntentSchema,
]);

export type WebsiteIntent = z.infer<typeof websiteIntentSchema>;
```

**Type guards** for safe payload access:

```typescript
export function isChangeThemeIntent(intent: Intent): intent is ChangeThemeIntent {
  return intent.type === "change_theme";
}

export function isImproveCopyIntent(intent: Intent): intent is ImproveCopyIntent {
  return intent.type === "improve_copy";
}
```

### 2. Base Annotation (`langgraph_app/app/annotation/base.ts`)

Intent lives in `BaseAnnotation`, so all graphs automatically have it:

```typescript
export const BaseAnnotation = Annotation.Root({
  // ... other fields ...

  /** Intent: user action that triggered this graph invocation (consumed after handling) */
  intent: Annotation<Intent | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),
});
```

### 3. Intent Graph Factory (`langgraph_app/app/graphs/shared/createIntentGraph.ts`)

The factory creates a graph that:
- Routes to the matching intent subgraph (or `default`)
- Clears intent after subgraph completes
- Wraps with credit exhaustion tracking

```typescript
export function createIntentGraph<TIntentType extends string = string>() {
  return function <TAnnotation extends AnnotationRoot<any>>({
    annotation,
    intents,
  }: CreateIntentGraphOptions<TAnnotation, TIntentType>) {
    // Router function - checks intent type and returns matching node name
    const routeByIntent = (state: any): string => {
      const type = state.intent?.type;
      return type && intents[type] ? type : "default";
    };

    // Clear intent after flow completes
    const clearIntent = () => ({ intent: undefined });

    // Build graph: START → [intent subgraph] → clearIntent → END
    let graph = new StateGraph(annotation);

    for (const intentType of Object.keys(intents)) {
      graph = graph.addNode(intentType, intents[intentType]);
    }
    graph = graph.addNode("clearIntent", clearIntent);
    graph = graph.addConditionalEdges(START, routeByIntent, routeMap);

    for (const intentType of Object.keys(intents)) {
      graph = graph.addEdge(intentType, "clearIntent");
    }
    graph = graph.addEdge("clearIntent", END);

    return withCreditExhaustion(graph, annotation);
  };
}
```

### 4. Website Graph (`langgraph_app/app/graphs/website.ts`)

Each intent maps to a compiled subgraph:

```typescript
// Subgraphs
const themeHandlerSubgraph = new StateGraph(WebsiteAnnotation)
  .addNode("themeHandler", themeHandler)
  .addEdge(START, "themeHandler")
  .addEdge("themeHandler", END)
  .compile();

const improveCopySubgraph = new StateGraph(WebsiteAnnotation)
  .addNode("improveCopy", improveCopyNode)
  .addNode("cleanupFilesystem", cleanupFilesystemNode)
  .addNode("syncFiles", syncFilesNode)
  .addEdge(START, "improveCopy")
  .addEdge("improveCopy", "cleanupFilesystem")
  .addEdge("cleanupFilesystem", "syncFiles")
  .addEdge("syncFiles", END)
  .compile();

const websiteBuilderSubgraph = new StateGraph(WebsiteAnnotation)
  // ... full builder flow with parallel domain recommendations
  .compile();

// Main graph using factory
export const websiteGraph = createIntentGraph<WebsiteIntent["type"]>()({
  annotation: WebsiteAnnotation,
  intents: {
    change_theme: themeHandlerSubgraph,
    improve_copy: improveCopySubgraph,
    default: websiteBuilderSubgraph,
  },
});
```

### 5. Intent Handler Nodes

Intent handlers validate the intent type and extract payload:

```typescript
// themeHandler.ts
export const themeHandler = NodeMiddleware.use(
  {},
  async (state: WebsiteGraphState, config): Promise<Partial<WebsiteGraphState>> => {
    const { intent, websiteId, jwt } = state;

    // Validate intent type
    if (!intent || !isChangeThemeIntent(intent)) {
      throw new Error("themeHandler called without change_theme intent");
    }

    // Extract typed payload
    const { themeId } = intent.payload;

    // Execute action
    const websiteAPI = new WebsiteAPIService({ jwt });
    await websiteAPI.update(websiteId, { theme_id: themeId });

    // Return updated state
    return {
      files: updatedFiles,
      status: "completed",
    };
  }
);
```

For intents with payload data:

```typescript
// improveCopy.ts
export const improveCopyNode = NodeMiddleware.use(
  {},
  async (state: WebsiteGraphState, config): Promise<Partial<WebsiteGraphState>> => {
    // Get style from intent payload
    const style = isImproveCopyIntent(state.intent!)
      ? (state.intent.payload.style as Website.ImproveCopyStyle | undefined)
      : undefined;

    const prompt = getImproveCopyPrompt(style);
    // ... run agent with prompt
  }
);
```

---

## Frontend Integration

### Intent Stash (`lib/intent.ts`)

Intents can be stashed before navigation and consumed on the target page. This handles cross-page intent flows (e.g., click theme on brainstorm page → navigate to website page → apply theme).

```typescript
import type { Intent } from "@shared/types/intent";

const INTENT_KEY = "launch10_pending_intent";
const INTENT_EXPIRY_MS = 30 * 1000; // 30 seconds

/**
 * Stash an intent for later consumption.
 * Call this before navigation when intent should be handled on another page.
 */
export function stashIntent(intent: Omit<Intent, "createdAt">): void {
  localStorage.setItem(
    INTENT_KEY,
    JSON.stringify({
      ...intent,
      createdAt: new Date().toISOString(),
    })
  );
}

/**
 * Consume (pop) a stashed intent.
 * Returns null if no intent or if expired (>30s old).
 */
export function consumeIntent(): Intent | null {
  const raw = localStorage.getItem(INTENT_KEY);
  if (!raw) return null;

  localStorage.removeItem(INTENT_KEY);

  const intent = JSON.parse(raw) as Intent;
  if (Date.now() - new Date(intent.createdAt).getTime() > INTENT_EXPIRY_MS) {
    return null; // Expired
  }
  return intent;
}

/**
 * Peek at stashed intent without consuming it.
 */
export function peekIntent(): Intent | null {
  const raw = localStorage.getItem(INTENT_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as Intent;
}

/**
 * Clear any stashed intent.
 */
export function clearIntent(): void {
  localStorage.removeItem(INTENT_KEY);
}
```

### Navigate with Intent

When an action requires navigating to another page before invoking the graph:

```typescript
import { router } from "@inertiajs/react";
import { stashIntent } from "@/lib/intent";

/**
 * Stash intent and navigate to target page.
 * Target page will detect and consume the intent on mount.
 */
export function navigateWithIntent(
  path: string,
  intent: Omit<Intent, "createdAt">
): void {
  stashIntent(intent);
  router.visit(path);
}

// Usage: User clicks theme selector on Brainstorm page
function onThemeSelect(themeId: number) {
  navigateWithIntent(`/projects/${projectId}/website`, {
    type: "change_theme",
    payload: { themeId },
  });
}
```

### Consuming Intent on Page Mount

Pages that can receive intents use a hook to detect and handle stashed intents:

```typescript
import { useEffect } from "react";
import { consumeIntent } from "@/lib/intent";

/**
 * Hook that checks for stashed intent on mount and invokes callback.
 * Intent is consumed (removed from stash) when detected.
 */
export function useIntentOnMount(
  onIntent: (intent: Intent) => void,
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    const intent = consumeIntent();
    if (intent) {
      onIntent(intent);
    }
  }, deps);
}

// Usage in WebsitePage component
function WebsitePage({ project, website }) {
  const { updateState } = useWebsiteGraph();

  useIntentOnMount((intent) => {
    // Push intent into graph state - this triggers the intent flow
    updateState({ intent });
  }, [updateState]);

  return <WebsiteBuilder />;
}
```

### Direct Intent Invocation (Same Page)

When intent is triggered on the same page (no navigation needed):

```typescript
// Option 1: updateState (merges into current state, triggers graph)
function onThemeSelect(themeId: number) {
  updateState({
    intent: {
      type: "change_theme",
      payload: { themeId },
      createdAt: new Date().toISOString(),
    },
  });
}

// Option 2: sendMessage with intent (for intents that also have a message)
function onImproveCopy(style: string) {
  sendMessage("Make the copy more professional", {
    intent: {
      type: "improve_copy",
      payload: { style },
      createdAt: new Date().toISOString(),
    },
  });
}
```

### Flow Diagrams

**Same-page intent (e.g., click theme on Website page):**
```
User clicks theme
       │
       ▼
updateState({ intent: { type: "change_theme", ... } })
       │
       ▼
Graph invoked with intent → themeHandler → clearIntent → END
       │
       ▼
Frontend receives updated files
```

**Cross-page intent (e.g., click theme on Brainstorm page):**
```
User clicks theme on Brainstorm page
       │
       ▼
stashIntent({ type: "change_theme", payload: { themeId } })
       │
       ▼
router.visit("/projects/:id/website")
       │
       ▼
WebsitePage mounts
       │
       ▼
useIntentOnMount detects stashed intent
       │
       ▼
consumeIntent() returns intent (clears stash)
       │
       ▼
updateState({ intent }) triggers graph
       │
       ▼
Graph invoked with intent → themeHandler → clearIntent → END
```

---

## Current Intents

### Website Graph

| Intent Type | Payload | Description |
|-------------|---------|-------------|
| `change_theme` | `{ themeId: number }` | Updates theme via Rails API (silent, no AI) |
| `improve_copy` | `{ style?: string }` | Regenerates copy with style (professional, friendly, shorter) |
| `upload_images` | `{ fileIds: number[] }` | (Planned) Handle uploaded images |
| `delete_image` | `{ imageId: number }` | (Planned) Remove an image |
| (none/default) | - | Full website builder flow |

### Brainstorm Graph (Planned)

| Intent Type | Payload | Description |
|-------------|---------|-------------|
| `skip_topic` | `{ topic: string }` | Skip current brainstorm topic |
| `do_the_rest` | `{}` | Auto-complete remaining topics |

---

## Design Decisions

1. **Subgraphs over nodes** - Each intent has its own subgraph for isolation and flexibility
2. **Automatic intent clearing** - Factory handles cleanup, handlers don't need to
3. **Type guards** - Safe payload access with TypeScript narrowing
4. **`snake_case` intent types** - Matches Rails/database conventions
5. **`default` required** - Every intent graph must have a fallback flow

---

## Adding a New Intent

1. Add schema to `shared/types/intent.ts`:
   ```typescript
   export const myIntentSchema = z.object({
     type: z.literal("my_intent"),
     payload: z.object({ /* ... */ }),
     createdAt: z.string(),
   });
   ```

2. Add to discriminated union and type guards

3. Create handler node in `langgraph_app/app/nodes/{domain}/`

4. Create subgraph and add to `createIntentGraph` call:
   ```typescript
   const myIntentSubgraph = new StateGraph(Annotation)
     .addNode("handler", myIntentHandler)
     .addEdge(START, "handler")
     .addEdge("handler", END)
     .compile();

   export const graph = createIntentGraph<IntentType>()({
     annotation: Annotation,
     intents: {
       my_intent: myIntentSubgraph,
       default: defaultSubgraph,
     },
   });
   ```
