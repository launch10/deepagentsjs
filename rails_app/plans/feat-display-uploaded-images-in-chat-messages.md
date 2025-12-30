# feat: Display Uploaded Images in Chat Messages

## Overview

When users upload images in the Brainstorm Chat, those images should be displayed alongside the messages they were attached to. Currently, images are sent to the AI but not displayed in the conversation history.

## Problem Statement

**Current:** User sends message with image → Message shows text only → Image is invisible in history

**Expected:** User sends message with image → Message shows text AND image thumbnail → Clickable to view full size

## Root Cause

Images ARE already stored in LangChain messages (as `image_url` content blocks) and persisted via the checkpointer. The problem is the SDK's `transformMessages` function throws them away - it only extracts text content.

## Solution (~60 lines total)

### 1. Add `ImageMessageBlock` type (5 lines)

```typescript
// packages/langgraph-ai-sdk-types/src/index.ts

export interface ImageMessageBlock {
  type: 'image';
  index: number;
  url: string;
  id: string;
}
```

Add to the `MessageBlock` union type.

### 2. Update transform to extract images (15 lines)

```typescript
// packages/langgraph-ai-sdk-react/src/langgraphChat.ts
// In the function that transforms user messages:

if (msg.role === 'user') {
  const blocks: MessageBlock[] = [];
  let index = 0;

  // Handle array content (multimodal)
  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.type === 'text') {
        blocks.push({
          type: 'text',
          index,
          text: part.text,
          id: `${msg.id}-text-${index++}`
        });
      } else if (part.type === 'image_url') {
        const url = typeof part.image_url === 'string'
          ? part.image_url
          : part.image_url.url;
        blocks.push({
          type: 'image',
          index,
          url,
          id: `${msg.id}-img-${index++}`
        });
      }
    }
  } else if (typeof msg.content === 'string') {
    blocks.push({
      type: 'text',
      index: 0,
      text: msg.content,
      id: `${msg.id}-text-0`
    });
  }

  return { id: msg.id, role: msg.role, blocks };
}
```

### 3. Create `MessageImages` component (35 lines)

```tsx
// app/javascript/frontend/components/brainstorm/MessageImages.tsx

import { useState } from 'react';
import type { ImageMessageBlock } from '@launch10/langgraph-ai-sdk-types';

export function MessageImages({ images }: { images: ImageMessageBlock[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!images.length) return null;

  return (
    <>
      <div className={`grid grid-cols-2 gap-2 mt-2 max-w-md ${images.length === 1 ? '[&>*]:col-span-2' : ''}`}>
        {images.map((img) => (
          <button
            key={img.id}
            onClick={() => setExpanded(img.id)}
            className="aspect-square rounded-lg overflow-hidden bg-muted"
          >
            <img
              src={img.url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpanded(null)}
        >
          <img
            src={images.find(i => i.id === expanded)?.url}
            alt=""
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </>
  );
}
```

### 4. Update `BrainstormMessages` to render images (10 lines)

```tsx
// app/javascript/frontend/components/brainstorm/BrainstormMessages.tsx

import { MessageImages } from './MessageImages';

// In the user message rendering:
if (isUser) {
  const textContent = message.blocks
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("");

  const imageBlocks = message.blocks.filter(
    (b): b is ImageMessageBlock => b.type === "image"
  );

  return (
    <Chat.UserMessage key={message.id}>
      {textContent}
      <MessageImages images={imageBlocks} />
    </Chat.UserMessage>
  );
}
```

## Files to Modify

| File | Change |
|------|--------|
| `../packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-types/src/index.ts` | Add `ImageMessageBlock` type to union |
| `../packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/langgraphChat.ts` | Extract `image_url` parts in transform |
| `app/javascript/frontend/components/brainstorm/MessageImages.tsx` | NEW: Single component with inline lightbox |
| `app/javascript/frontend/components/brainstorm/BrainstormMessages.tsx` | Render image blocks |

## Acceptance Criteria

- [ ] User messages with images display both text and image thumbnails
- [ ] Images are clickable to view full size
- [ ] Images persist after page refresh
- [ ] Multiple images display in 2-column grid
- [ ] Single image displays full width

## Technical Notes

### URL Strategy
Images are stored in Cloudflare R2 with permanent public URLs. No expiration handling needed.

### What We're NOT Building (YAGNI)
- Separate lightbox component (inline is fine)
- Loading skeletons (browser handles natively)
- Error retry buttons (permanent URLs don't fail)
- "Show more" for 6+ images (rare case)
- Keyboard accessibility for lightbox (v2 if needed)
- Thumbnail URL variants (full URL works fine)

## References

- `app/javascript/frontend/stores/brainstormInput.ts` - Current attachment state
- `../langgraph_app/app/services/brainstorm/uploadInjectionService.ts` - How images are injected into messages
- `../packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/langgraphChat.ts` - Transform function location
