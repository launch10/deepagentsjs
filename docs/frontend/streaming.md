# Real-Time Streaming & Chat UI

SSE streaming from Langgraph to React via a custom `langgraph-ai-sdk` package. The SDK provides `useLanggraph` for chat management, `SmartSubscription` for fine-grained re-renders, and a compound Chat component system for the UI layer.

## Streaming Flow

```
User sends message
       │
       ▼
HTTP POST to Langgraph (api/brainstorm/stream, api/website/stream, etc.)
  ├─ JWT in Authorization header
  ├─ threadId, message content, attachments
  └─ optional: additional state via body.state
       │
       ▼
Server-Sent Events (SSE) stream
  ├─ message parts (text, tool calls, structured data)
  ├─ state updates (data-state-*, data-state-final-*)
  └─ status changes (streaming → idle)
       │
       ▼
LanggraphChat processes events
  ├─ StateManager: updates Langgraph state, fires per-key callbacks
  ├─ DerivedDataCache: transforms raw parts → typed blocks
  └─ ComposerManager: resets after send
       │
       ▼
SmartSubscription detects accessed properties
  └─ Only re-renders components that read changed data
       │
       ▼
React component re-render (Chat.AIMessage, status indicators, etc.)
```

## useLanggraph Hook

**File:** `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/useLanggraph.tsx`

Core hook that manages the chat lifecycle. Returns either the full chat snapshot or a selected value.

```typescript
const options = {
  api: `${langgraph_path}/api/website/stream`,
  headers: { Authorization: `Bearer ${jwt}` },
  getInitialThreadId: () => thread_id,
  onThreadIdAvailable: (threadId) => {
    /* sync to URL/store */
  },
};

// Full snapshot
const chat = useLanggraph(options);

// Selected value (fine-grained re-renders)
const messages = useLanggraph(options, (s) => s.messages);
```

**Chat Registry** — singleton per `api::threadId` identity:

- Key format: `${api}::${threadId ?? '__new__'}`
- Ref counting: acquire on mount, release on unmount
- Cleanup: abort history load when refCount hits 0
- Rekeying: moves from `api::__new__` to `api::realId` after first interaction

**History loading:**

- Triggered when `!chat.isNewChat && !chat.historyLoaded`
- Fetch: `GET ${api}?threadId=${threadId}`
- Deduped by `loaded` flag, retries with exponential backoff

## SmartSubscription

**File:** `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/useSmartSubscription.ts`

Access-detected selective re-renders via proxy-based dependency tracking.

**How it works:**

1. Selector runs against a tracking proxy
2. Proxy records which snapshot properties were accessed (messages, status, state, etc.)
3. Hook subscribes only to callbacks for accessed properties
4. On callback, re-runs selector and checks `shallowEqual` before triggering re-render

**Result:** A component reading only `messages` won't re-render when `status` changes.

## LanggraphChat Class

**File:** `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/langgraphChat.ts`

Extends ai-sdk's Chat class with Langgraph-specific state management.

### StateManager

**File:** `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/StateManager.ts`

Handles Langgraph state with streaming support:

- `setState(partial)` — direct state updates with callbacks
- `processStatePart(part)` — handles streaming state updates
- `subscribeState(callback)` — global state listener
- `subscribeStateKey(key, callback)` — per-key listener for fine-grained subscriptions

**Streaming state types:**

- `data-state-*` — regular streaming updates
- `data-state-streaming-*` — custom merge reducer applied if configured
- `data-state-final-*` — finalized, no more merges for this key

### DerivedDataCache

**File:** `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/DerivedDataCache.ts`

Transforms raw message parts into typed blocks:

| Block Type   | Description                                       |
| ------------ | ------------------------------------------------- |
| `text`       | Text content                                      |
| `structured` | Structured JSON data                              |
| `reasoning`  | Extended thinking/reasoning                       |
| `tool_call`  | Tool invocations (status: running/complete/error) |
| `image`      | User-uploaded images                              |
| `file`       | User-uploaded documents                           |

Caches results and only recomputes when raw messages change.

### ComposerManager

**File:** `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/ComposerManager.ts`

Manages multimodal message composition:

- `text` — input text
- `attachments[]` — files with upload state
- `isReady` — has content AND not uploading AND no errors
- `getSnapshot()` — frozen snapshot for React reference stability

### HistoryLoader

**File:** `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/HistoryLoader.ts`

Fetches chat history with retry logic. Exponential backoff on failure, abort signal propagation on unmount.

## Chat Compound Components

**File:** `rails_app/app/javascript/frontend/components/shared/chat/Chat.tsx`

Context-aware UI system. Wrap with `Chat.Root` and all subcomponents access messages, composer, status, and actions automatically.

```tsx
<Chat.Root chat={chat}>
  <Chat.Messages.List>
    {messages.map((msg) =>
      msg.role === "user" ? (
        <Chat.UserMessage key={msg.id} blocks={msg.blocks} />
      ) : (
        <Chat.AIMessage.Root key={msg.id}>
          <Chat.BlockRenderer blocks={msg.blocks} />
        </Chat.AIMessage.Root>
      )
    )}
    <Chat.Messages.StreamingIndicator />
    <Chat.Messages.ScrollAnchor />
  </Chat.Messages.List>
  <Chat.Input.DropZone>
    <Chat.Input.AttachmentList />
    <Chat.Input.Textarea placeholder="Type..." />
    <Chat.Input.FileButton />
    <Chat.Input.SubmitButton stopIcon={<StopIcon />}>
      <ArrowUpIcon />
    </Chat.Input.SubmitButton>
  </Chat.Input.DropZone>
</Chat.Root>
```

### Component Reference

| Component                          | File                                          | Purpose                                       |
| ---------------------------------- | --------------------------------------------- | --------------------------------------------- |
| `Chat.Root`                        | `shared/chat/Root.tsx`                        | Provider wrapper, creates ChatContext         |
| `Chat.Messages.List`               | `shared/chat/messages/List.tsx`               | Container with `role="log"` for accessibility |
| `Chat.Messages.StreamingIndicator` | `shared/chat/messages/StreamingIndicator.tsx` | Auto-shows when streaming + no AI content yet |
| `Chat.Messages.ScrollAnchor`       | `shared/chat/messages/ScrollAnchor.tsx`       | Auto-scrolls to bottom on new messages        |
| `Chat.AIMessage.Root`              | `shared/chat/AIMessage.tsx`                   | AI message wrapper                            |
| `Chat.AIMessage.Content`           | `shared/chat/AIMessage.tsx`                   | Renders markdown via ReactMarkdown            |
| `Chat.UserMessage`                 | `shared/chat/UserMessage.tsx`                 | User message with attachment support          |
| `Chat.BlockRenderer`               | `shared/chat/BlockRenderer.tsx`               | Dispatches text/structured/tool_call blocks   |
| `Chat.Input.Textarea`              | `shared/chat/input/Textarea.tsx`              | Context-aware input, binds to composer        |
| `Chat.Input.SubmitButton`          | `shared/chat/input/SubmitButton.tsx`          | Submit/stop toggle button                     |
| `Chat.Input.FileButton`            | `shared/chat/input/FileButton.tsx`            | File upload trigger                           |
| `Chat.Input.DropZone`              | `shared/chat/input/DropZone.tsx`              | Drag-and-drop file area                       |
| `Chat.Input.AttachmentList`        | `shared/chat/input/AttachmentList.tsx`        | Shows pending file attachments                |
| `ThinkingIndicator`                | `shared/chat/ThinkingIndicator.tsx`           | Rocket spinner + "Thinking..." text           |
| `Suggestions`                      | `shared/chat/Suggestions.tsx`                 | Clickable suggestion chips                    |
| `IntentButtons`                    | `shared/chat/IntentButtons.tsx`               | Action buttons within messages                |

## ChatContext

**File:** `rails_app/app/javascript/frontend/components/shared/chat/ChatContext.tsx`

Provides stable chat instance and fine-grained selectors:

| Hook                   | Subscribes To        | Purpose                                                     |
| ---------------------- | -------------------- | ----------------------------------------------------------- |
| `useChatMessages()`    | messages             | Get message list with blocks                                |
| `useChatComposer()`    | composer             | Get input text and attachments                              |
| `useChatStatus()`      | status               | Get raw status ('ready', 'streaming', 'submitted', 'error') |
| `useChatIsStreaming()` | isStreaming          | `status === 'streaming' \|\| status === 'submitted'`        |
| `useChatIsLoading()`   | isLoading            | History loading or streaming                                |
| `useChatIsReady()`     | isReady              | Not loading, not streaming, no error                        |
| `useChatState()`       | state                | Get Langgraph state                                         |
| `useChatError()`       | error                | Get error object                                            |
| `useChatThreadId()`    | threadId             | Get thread ID                                               |
| `useChatActions()`     | actions (stable ref) | sendMessage, updateState, setState, stop, clearError        |
| `useChatSubmit()`      | actions (stable ref) | Submit handler (respects `Chat.Root` onSubmit)              |
| `useChatStop()`        | stop (stable ref)    | Stop streaming                                              |

**Out-of-credits detection** runs automatically in `Chat.Root`:

- Path 1: Error middleware returns 402 with `CREDITS_EXHAUSTED`
- Path 2: Stream contains `creditStatus` in state
- Either triggers `CreditWarningModal` via `creditStore.showModal()`

## Domain-Specific Chat Hooks

### useBrainstormChat

**File:** `rails_app/app/javascript/frontend/components/brainstorm/hooks/useBrainstormChat.ts`

```typescript
const chat = useBrainstormChat();
```

- API path: `api/brainstorm/stream`
- Thread ID from URL params or Inertia page props
- File uploads via `UploadsAPIService`
- Selectors: `useBrainstormMessages()`, `useBrainstormStatus()`, `useBrainstormIsLoading()`, `useBrainstormComposer()`

### useWebsiteChat

**File:** `rails_app/app/javascript/frontend/hooks/website/useWebsiteChat.ts`

```typescript
const chat = useWebsiteChat();
```

- API path: `api/website/stream`
- Uses shared `useChatOptions` hook
- Selectors: `useWebsiteChatMessages()`, `useWebsiteChatState(key)`, `useWebsiteChatIsStreaming()`, `useWebsiteChatComposer()`

### useChatOptions (shared factory)

**File:** `rails_app/app/javascript/frontend/hooks/useChatOptions.ts`

Reusable factory for `UseLanggraphOptions`:

- Reads `thread_id`, `jwt`, `langgraph_path`, `root_path` from Inertia page props
- Configures auth headers, merge reducers, file upload handling
- Used by brainstorm, website, ads, deploy, insights, and support chats

## Key Files Index

### SDK (langgraph-ai-sdk)

| File                                                                                    | Purpose                                   |
| --------------------------------------------------------------------------------------- | ----------------------------------------- |
| `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/useLanggraph.tsx`        | Core hook, chat registry, history loading |
| `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/useSmartSubscription.ts` | Access-detected selective re-renders      |
| `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/langgraphChat.ts`        | Chat class with state management          |
| `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/StateManager.ts`         | Langgraph state processing                |
| `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/DerivedDataCache.ts`     | Raw parts → typed blocks                  |
| `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/ComposerManager.ts`      | Multimodal message composition            |
| `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/HistoryLoader.ts`        | Chat history with retry                   |
| `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/chatRegistry.ts`         | Singleton chat registry                   |
| `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/accessDetector.ts`       | Proxy-based property access tracking      |

### Frontend Components

| File                                                                                 | Purpose                           |
| ------------------------------------------------------------------------------------ | --------------------------------- |
| `rails_app/app/javascript/frontend/components/shared/chat/Chat.tsx`                  | Chat compound component exports   |
| `rails_app/app/javascript/frontend/components/shared/chat/ChatContext.tsx`           | Chat context and selector hooks   |
| `rails_app/app/javascript/frontend/components/shared/chat/Root.tsx`                  | Chat.Root provider                |
| `rails_app/app/javascript/frontend/components/shared/chat/BlockRenderer.tsx`         | Block type dispatcher             |
| `rails_app/app/javascript/frontend/components/shared/chat/AIMessage.tsx`             | AI message compound               |
| `rails_app/app/javascript/frontend/components/shared/chat/ThinkingIndicator.tsx`     | Thinking spinner                  |
| `rails_app/app/javascript/frontend/hooks/useChatOptions.ts`                          | Shared chat configuration factory |
| `rails_app/app/javascript/frontend/components/brainstorm/hooks/useBrainstormChat.ts` | Brainstorm chat hook              |
| `rails_app/app/javascript/frontend/hooks/website/useWebsiteChat.ts`                  | Website chat hook                 |
| `rails_app/app/javascript/frontend/stores/chatsRegistry.ts`                          | Active chat instance mapping      |

## Related Docs

- [overview.md](./overview.md) — Frontend architecture
- [components.md](./components.md) — Chat compound component structure
- [website-builder-ui.md](./website-builder-ui.md) — How website chat integrates with preview
- [Agent Infrastructure: Chat System](../agent-infrastructure/chat-system.md) — Backend chat system
- [Agent Infrastructure: Langgraph SDK](../agent-infrastructure/langgraph-sdk.md) — SDK architecture
