# langgraph-ai-sdk Decisions

This document records architectural decisions for the langgraph-ai-sdk package that bridges React frontend to Langgraph backend.

---

## Current State

The SDK provides `useLanggraph` hook with SmartSubscription pattern for granular state subscriptions, Bridge types for end-to-end type safety, and message block architecture for structured AI responses.

---

## Decision Log

### 2025-12-28: Build Custom SDK vs Use Vercel AI SDK

**Context:** Needed to connect React frontend to Langgraph backend with streaming, state management, and structured data support.

**Decision:** Build langgraph-ai-sdk rather than use Vercel AI SDK directly.

**Why:**
- Vercel AI SDK gaps: doesn't handle Langgraph-specific needs (graph state, structured data blocks, tool calls with state)
- Need typed Bridge interface connecting frontend types to graph state types
- Need granular subscriptions to prevent unnecessary re-renders
- Need first-class support for streaming structured data (not just text)

**Trade-offs:**
- More code to maintain
- But: full control over subscription model and type safety
- But: can optimize for our specific patterns

**Status:** Current

---

### 2025-12-28: SDK Owns ThreadId Generation

**Context:** Initially, the client generated UUIDs for new conversations before the SDK was ready, causing timing issues between client state and SDK state.

**Decision:** Delegate threadId generation and management to the SDK. The SDK provides the threadId, components consume it.

**Why:**
- Single source of truth for thread identity
- SDK can coordinate threadId with Langgraph backend properly
- Eliminates race conditions between client UUID generation and SDK initialization
- URL updates can use `replaceState` with SDK-provided threadId

**Before (problematic):**
```tsx
// Client generates UUID too early
const projectId = uuidv4();
setLocalThreadId(projectId);  // Timing issues with SDK
```

**After (current):**
```tsx
// SDK provides threadId when ready
const { threadId } = useLanggraph<BrainstormBridgeType>(options);

useEffect(() => {
  if (threadId) {
    window.history.replaceState({}, "", `/projects/${threadId}/brainstorm`);
  }
}, [threadId]);
```

**Supersedes:** Client-side early UUID generation approach

**Status:** Current

---

### 2025-12-28: SDK Hooks Over Manual Store Syncing

**Context:** Early approach had components manually syncing SDK state to Zustand store via multiple useEffects. This duplicated SDK logic and created potential bugs.

**Decision:** Use SDK-provided hooks directly. Only sync to store when truly necessary for cross-component state sharing.

**Why:**
- SDK handles edge cases (streaming, tool calls, reasoning blocks)
- Single source of truth for message state
- Consistent error handling
- Reduces boilerplate

**Pattern evolution:**
```tsx
// Before: Manual syncing
const { messages: sdkMessages } = useLanggraph(options);
useEffect(() => setMessages(sdkMessages), [sdkMessages]);

// After: Direct SDK subscription (target state)
const { messages } = useLanggraph<BrainstormBridgeType>(options);
// SmartSubscription detects accessed properties automatically
```

**Files establishing pattern:**
- `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/useLanggraph.ts`
- `rails_app/app/javascript/frontend/hooks/useBrainstormChat.ts`

**Status:** Current

---

### 2025-12-28: SmartSubscription for Granular Updates

**Context:** Needed to prevent unnecessary re-renders when only specific parts of chat state change.

**Decision:** Implement SmartSubscription pattern that detects which properties a selector accesses and only subscribes to those.

**Why:**
- Components only re-render when their accessed properties change
- No manual dependency tracking needed
- Works with any selector function
- Scales as state complexity grows

**How it works:**
1. Selector function runs against proxy-wrapped state
2. Proxy tracks which properties were accessed
3. SDK registers callbacks only for accessed properties
4. Changes to unaccessed properties don't trigger re-render

**Files establishing pattern:**
- `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/useSmartSubscription.ts`

**Status:** Current

---

### 2025-12-28: Bridge Types for End-to-End Type Safety

**Context:** Needed type safety from React components through SDK to Langgraph graph state.

**Decision:** Define Bridge types that specify State, Data, and ToolInput types, enforced across the entire stack.

**Pattern:**
```typescript
// Bridge definition connects all the types
export interface BrainstormBridgeType extends Bridge<
  BrainstormGraphState,      // What Langgraph produces
  BrainstormBridgeData,      // Structured message data
  BrainstormToolInput        // Tool call inputs
> {}

// In components
const { state, messages } = useLanggraph<BrainstormBridgeType>(options);
// state is typed as BrainstormGraphState
// message blocks are typed with BrainstormBridgeData
```

**Why:**
- Type errors caught at compile time
- IDE autocomplete works across stack boundaries
- Refactoring is safe
- Documentation is built into types

**Status:** Current

---

### 2025-12-28: Message Block Architecture

**Context:** AI messages can contain different types of content: plain text, structured data (examples, forms), and tool call status.

**Decision:** Use discriminated union pattern with block types: `TextMessageBlock`, `StructuredMessageBlock<T>`, `ToolCallMessageBlock`.

**Pattern:**
```typescript
function BlockRenderer({ block }: { block: MessageBlock<BrainstormData> }) {
  switch (block.type) {
    case "text":
      return <AIMessage.Content>{block.text}</AIMessage.Content>;
    case "structured":
      return <StructuredRenderer data={block.data} />;
    case "tool_call":
      return <ToolStatus block={block} />;
    default:
      return null;
  }
}
```

**Why:**
- Exhaustive pattern matching (TypeScript enforces handling all cases)
- Each block type has explicit structure
- Easy to add new block types
- Rendering logic is isolated per type

**Files establishing pattern:**
- `rails_app/app/javascript/frontend/components/brainstorm/BrainstormMessage.tsx`
- `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-types/src/index.ts`

**Status:** Current

---

## Superseded Decisions

### (Superseded) Client-Side Early UUID Generation

**Original Decision:** Generate conversation UUID on client before SDK initialization.

**Why Superseded:** Caused timing issues between client state and SDK state. SDK now owns threadId.

**Superseded by:** "SDK Owns ThreadId Generation" (2025-12-28)
