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

Convert the text-based image list to multimodal content blocks:

```typescript
import { createMultimodalPseudoMessage } from "@utils";

// Build multimodal content for images
const imageContent = state.images.length > 0
  ? [
      { type: "text", text: "## Images\nHere are the uploaded images:" },
      ...state.images.map((img) => ({
        type: "image_url",
        image_url: { url: img.url },
      })),
      { type: "text", text: state.images.map((img) =>
        `- ${img.url}${img.isLogo ? " (logo)" : ""}`
      ).join("\n") },
    ]
  : [{ type: "text", text: "## Images\nNo images uploaded" }];

// Create pseudo message with visual images
const imageMessage = createMultimodalPseudoMessage(imageContent);

const result = await agent.invoke({
  messages: [
    ...(state.messages || []),
    { role: "user", content: contextMessage },
    imageMessage,  // Inject images visually
  ],
  // ...
});
```

## Files to Modify

1. `langgraph_app/app/nodes/codingAgent/agent.ts` - Add multimodal image injection
