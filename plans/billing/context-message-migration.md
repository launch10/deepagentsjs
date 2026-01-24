# Context Message Migration Plan

## Overview

Migrate from `pseudoMessages` to `contextMessages` to preserve full conversation context for analytics while keeping UI clean.

**Problem**: PseudoMessages are filtered before saving to state, losing valuable context data forever.

**Solution**: ContextMessages stay in `state.messages` (preserved for analytics), filtered only at SDK layer for UI display.

---

## Why This Matters

| Current (PseudoMessages) | After (ContextMessages) |
|--------------------------|-------------------------|
| Filtered before state save | Stays in state.messages |
| Lost for analytics/replay | Preserved in traces |
| LLM forgets context next run | LLM sees context across runs |
| Can't debug what LLM saw | Full visibility into LLM inputs |

---

## Implementation Steps

### Phase 1: Create ContextMessage Utilities

**File**: `app/utils/contextMessages.ts`

```typescript
import { HumanMessage, type BaseMessage, type MessageContent } from "@langchain/core/messages";

/**
 * Context messages are visible to the model but hidden from the user.
 * They're stored in state.messages and filtered during SDK translation.
 *
 * Benefits:
 * - LLM sees context across all runs (not just the run it was injected)
 * - Full context preserved in traces for analytics/replay
 * - Clean separation: state is truth, SDK is presentation
 */
export const CONTEXT_MESSAGE_NAME = "context";

export const isContextMessage = (msg: BaseMessage): boolean => {
  return (msg as any).name === CONTEXT_MESSAGE_NAME;
};

export const createContextMessage = (
  content: string,
  metadata?: Record<string, unknown>
): HumanMessage => {
  return new HumanMessage({
    content,
    name: CONTEXT_MESSAGE_NAME,
    additional_kwargs: {
      context_type: "system_injected",
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  });
};

export const createMultimodalContextMessage = (
  content: MessageContent,
  metadata?: Record<string, unknown>
): HumanMessage => {
  return new HumanMessage({
    content,
    name: CONTEXT_MESSAGE_NAME,
    additional_kwargs: {
      context_type: "system_injected",
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  });
};
```

**Export from index**: Add to `app/utils/index.ts`

---

### Phase 2: Update SDK to Filter Context Messages

**File**: `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk/src/contextMessages.ts`

```typescript
import type { BaseMessage } from "@langchain/core/messages";

export const CONTEXT_MESSAGE_NAME = "context";

export const isContextMessage = (msg: BaseMessage): boolean => {
  return (msg as any).name === CONTEXT_MESSAGE_NAME;
};
```

**Update `stream.ts`**:

1. In `loadThreadHistory`:
```typescript
const messages = (stateSnapshot.values.messages as BaseMessage[]) || [];
const visibleMessages = messages.filter(msg => !isContextMessage(msg));
const uiMessages = visibleMessages.map((msg, idx) => { ... });
```

2. In `RawMessageHandler.handle()`:
```typescript
if (isContextMessage(message)) return; // Skip context messages during streaming
```

---

### Phase 3: Migrate Existing Usage

Replace `pseudoMessage` calls with `contextMessage` equivalents. **Do NOT remove filtering in nodes yet** - that happens after SDK filtering is in place.

| File | Change |
|------|--------|
| `app/nodes/website/websiteBuilder.ts` | `createPseudoMessage` → `createContextMessage` |
| `app/tools/brainstorm/queryUploads.ts` | `createPseudoMessage` → `createContextMessage` |
| `app/prompts/ads/assets/main.ts` | `createPseudoMessage` → `createContextMessage` |
| `app/prompts/ads/index.ts` | `createPseudoMessage` → `createContextMessage` |
| `app/prompts/ads/assets/helpers/needsIntent.ts` | `createPseudoMessage` → `createContextMessage` |

---

### Phase 4: Remove State Filtering

Once SDK filtering is in place, remove `filterPseudoMessages` calls from nodes:

```typescript
// BEFORE
const filteredMessages = filterPseudoMessages(messages as BaseMessage[]);
return { messages: filteredMessages, ... };

// AFTER
return { messages, ... };  // Keep everything
```

---

### Phase 5: Deprecate PseudoMessages

1. Add deprecation notice to `app/utils/pseudoMessages.ts`:
```typescript
/**
 * @deprecated Use contextMessages.ts instead.
 * PseudoMessages are filtered before saving, losing data.
 * ContextMessages stay in state and are filtered at SDK layer.
 */
```

2. After all usages migrated, delete `pseudoMessages.ts`

---

## Testing Plan

### Unit Tests (`contextMessages.test.ts`)

```typescript
describe("contextMessages", () => {
  describe("createContextMessage", () => {
    it("creates HumanMessage with context name", () => {
      const msg = createContextMessage("User is on pricing page");
      expect(msg._getType()).toBe("human");
      expect((msg as any).name).toBe("context");
    });

    it("includes metadata in additional_kwargs", () => {
      const msg = createContextMessage("context", { source: "router" });
      expect(msg.additional_kwargs.context_type).toBe("system_injected");
      expect(msg.additional_kwargs.source).toBe("router");
      expect(msg.additional_kwargs.timestamp).toBeDefined();
    });
  });

  describe("isContextMessage", () => {
    it("returns true for context messages", () => {
      const msg = createContextMessage("test");
      expect(isContextMessage(msg)).toBe(true);
    });

    it("returns false for regular messages", () => {
      const msg = new HumanMessage("test");
      expect(isContextMessage(msg)).toBe(false);
    });

    it("returns false for pseudo messages (backwards compat)", () => {
      const msg = createPseudoMessage("test");
      expect(isContextMessage(msg)).toBe(false);
    });
  });

  describe("createMultimodalContextMessage", () => {
    it("handles image content", () => {
      const content = [
        { type: "text", text: "Screenshot:" },
        { type: "image_url", image_url: { url: "data:image/png;base64,..." } }
      ];
      const msg = createMultimodalContextMessage(content);
      expect((msg as any).name).toBe("context");
      expect(msg.content).toEqual(content);
    });
  });
});
```

### Integration Tests

1. **Context messages persist in state**:
   - Create context message in node
   - Verify it exists in checkpoint after run
   - Verify LLM receives it on next run

2. **SDK filters context messages**:
   - Run graph that produces context + regular messages
   - Load thread history via SDK
   - Verify context messages excluded from UI response

3. **Traces include context messages**:
   - Run graph with context messages
   - Verify `messagesProduced` includes context messages
   - Verify `is_context_message` flag set correctly in trace

---

## Rollout Strategy

1. **Phase 1-2**: Ship utilities and SDK filtering (no behavior change yet)
2. **Phase 3**: Migrate to `createContextMessage` (still filtering in nodes)
3. **Phase 4**: Remove node filtering (context now persists)
4. **Phase 5**: Delete deprecated code

Each phase is independently deployable. Rollback is safe at any point.

---

## Success Criteria

- [x] Context messages use `name: "context"` instead of `additional_kwargs.isPseudo`
- [x] SDK filters context messages from UI (via `isContextMessage` check)
- [x] `shared/types/message.ts` utilities exclude context messages from counts
- [x] All `createPseudoMessage` calls migrated to `createContextMessage`
- [x] `filterPseudoMessages` calls removed from nodes (brainstorm, ads agents)
- [x] Context messages preserved in state for conversation traces
- [x] `pseudoMessages.ts` deleted - all imports now from `langgraph-ai-sdk`
- [x] All deprecated aliases removed (no vestiges of `isPseudo` naming)
- [x] No user-visible behavior change (UI still clean)

## Completed: 2026-01-23

### Changes Made

1. **Updated `shared/types/message.ts`**
   - Added import of `isContextMessage` from `langgraph-ai-sdk`
   - Updated `firstHumanMessage`, `lastHumanMessage`, `countHumanMessages`, `isFirstMessage` to exclude context messages

2. **Deleted `app/utils/pseudoMessages.ts`**
   - All imports now use `langgraph-ai-sdk` directly
   - Removed from `app/utils/index.ts` exports

3. **Renamed and cleaned `app/prompts/ads/contextMessages.ts`**
   - Renamed from `pseudoMessages.ts` to `contextMessages.ts`
   - All deprecated aliases removed (no vestiges of `isPseudo` naming)
   - Imports directly from `langgraph-ai-sdk`

4. **Removed filtering from nodes** (context messages preserved for traces)
   - `app/nodes/brainstorm/agent.ts` - Removed `filterPseudoMessages` call
   - `app/nodes/ads/agent.ts` - Removed `filterPseudoMessages` call

5. **Updated all callers to use new naming**
   - `app/nodes/website/websiteBuilder.ts` - Uses `createContextMessage`, `createMultimodalContextMessage`
   - `app/nodes/website/improveCopy.ts` - Uses `createContextMessage`
   - `app/prompts/ads/assets/main.ts` - Uses `isContextMessage`
   - `app/prompts/ads/assets/helpers/needsIntent.ts` - Uses `isContextMessage`
   - `app/nodes/ads/helpers/tools.ts` - Uses `isContextMessage`
   - `app/tools/brainstorm/queryUploads.ts` - Uses `createMultimodalContextMessage`

6. **Updated tests**
   - `tests/tests/utils/pseudoMessages.test.ts` - Tests new `name: "context"` pattern
   - `tests/tests/tools/brainstorm/queryUploads.test.ts` - Updated to test context messages
   - `tests/tests/graphs/ads/ads.test.ts` - Updated to use new naming (ContextMessages, getContextMessage, etc.)

7. **Added SDK dependency to shared**
   - Added `langgraph-ai-sdk: "workspace:*"` to `shared/package.json`

---

## Dependencies

- Usage tracking infrastructure (already implemented)
- Conversation traces table (see `conversation_traces.md`)

## Related Docs

- `plans/billing/conversation_traces.md` - Full trace architecture
- `plans/billing/langgraph_integration.md` - Callback infrastructure
