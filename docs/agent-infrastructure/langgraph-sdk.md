# Langgraph SDK

The frontend uses a custom `langgraph-ai-sdk-react` package to manage chat connections to Langgraph. The `useLanggraph` hook provides a registry-based singleton pattern — each chat is identified by `${api}::${threadId}` and shared across components. State is synced to Zustand stores for reactive UI updates.

## How It Works

```
React component
       │
       │ useBrainstormChat() / useWebsiteChat()
       ▼
useChatOptions() → { api, headers, getInitialThreadId }
       │
       │ useLanggraph(options, selector)
       ▼
Chat Registry (singleton per api::threadId)
       │
       │ chat.send(message)
       ▼
POST /api/{graph}/stream
  Authorization: Bearer <jwt>
       │
       │ SSE events
       ▼
Chat state updates → syncLanggraphToStore() → Zustand store
       │
       ▼
Selector hooks: useMessages(), useStatus(), useIsLoading()
```

## Hook Hierarchy

```
useBrainstormChat()
  └─ useChatOptions({ api: "/api/brainstorm/stream", threadId })
       └─ useLanggraph(options, s => s.chat)
            └─ Chat singleton (registry-managed)

useBrainstormMessages()
  └─ useLanggraph(options, s => s.messages)  // selector-based
```

## Bridge Pattern (Server-Side)

Each Langgraph graph exposes a Bridge that wraps the compiled graph with middleware:

```typescript
const brainstormBridge = createAppBridge({
  endpoint: "/api/brainstorm/stream",
  stateAnnotation: BrainstormAnnotation,
  messageSchema: brainstormMessageSchema,
});

// Applied middleware:
// 1. usageTrackingMiddleware (token tracking + billing)
```

The bridge provides `.stream()` and `.load()` methods called by Hono routes.

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/hooks/useChatOptions.ts` | Creates chat config (api URL, JWT, thread ID) |
| `rails_app/app/javascript/frontend/hooks/website/useWebsiteChat.ts` | Website chat hook |
| `rails_app/app/javascript/frontend/components/brainstorm/hooks/useBrainstormChat.ts` | Brainstorm chat hook |
| `rails_app/app/javascript/frontend/stores/creditStore.ts` | Credit state synced from streams |
| `langgraph_app/app/api/brainstorm.ts` | Brainstorm bridge definition |
| `langgraph_app/app/api/middleware/appBridge.ts` | Bridge factory with middleware |
| `langgraph_app/app/api/middleware/usageTracking.ts` | Stream middleware (billing on completion) |
| `packages/langgraph-ai-sdk/` | Custom SDK package |

## Gotchas

- **Chat identity is `${api}::${threadId}`**: Changing either creates a new chat instance. This is how the registry prevents duplicate connections.
- **Thread ID from URL**: On navigation, the hook reads `threadId` from URL pathname as a fallback when Inertia props haven't updated yet (handles `history.pushState` edge case).
- **`onThreadIdAvailable` callback**: Updates the browser URL when a new thread is created. Guards prevent duplicate `router.push()` calls.
- **Zustand sync**: `syncLanggraphToStore()` bridges the SDK's internal state to Zustand stores. This enables selector-based reactive access like `useBrainstormMessages()`.
