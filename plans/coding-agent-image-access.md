# Plan: Give Coding Agent Visual Access to Images/Logos

## Summary

Inject user-uploaded images as multimodal content so the coding agent can visually see them when building landing pages.

## Current State

- `buildContext` already fetches images from DB → `state.images`
- `agent.ts` injects images as **text URLs** (line 22-23) - agent can't see them
- `createMultimodalPseudoMessage` utility exists for visual image injection

## Implementation

### Single File Change

**File:** `langgraph_app/app/nodes/codingAgent/agent.ts`

Combine context message with visual images into a single multimodal message:

```typescript
import { createMultimodalPseudoMessage } from "@utils";

// Build user message - combine context with visual images
const userMessage =
  state.images.length > 0
    ? createMultimodalPseudoMessage([
        { type: "text" as const, text: contextMessage },
        ...state.images.map((img) => ({
          type: "image_url" as const,
          image_url: { url: img.url },
        })),
      ])
    : { role: "user", content: contextMessage };

const result = await agent.invoke({
  messages: [...(state.messages || []), userMessage],
  // ...
});
```

**Note:** The existing `contextMessage` already contains the `## Images` section with URLs and `(logo)` annotations. This change adds visual access to those images without duplicating the text metadata.

## Files to Modify

1. `langgraph_app/app/nodes/codingAgent/agent.ts` - Add multimodal image injection

## Tests To Add:

1. Unit test: `codingAgent.test.ts` - verify can see images (see `ads.test.ts` for similar examples)
2. Ensure pseudomessages are removed from final output (see `ads.test.ts` for similar examples)
