# feat: Support Image Message Blocks in SDK

## Overview

The `langgraph-ai-sdk` transforms LangChain messages into a simplified block-based format for React consumption. Currently, the transform only extracts text content from user messages. This means multimodal messages (text + images) lose their image data during transformation.

LangChain supports multimodal messages where `content` can be an array of content blocks including `image_url` types. The SDK should preserve this data so consumers can render images alongside text.

## Problem

When a LangChain `HumanMessage` contains multimodal content:

```typescript
// LangChain message format (what we receive from Langgraph)
{
  type: 'human',
  content: [
    { type: 'text', text: 'Check out this image' },
    { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
  ]
}
```

The current transform in `langgraphChat.ts` only extracts text:

```typescript
// Current behavior - images are discarded
if (msg.role === 'user') {
  const textPart = msg.parts.find(p => p.type === 'text');
  const text = textPart && 'text' in textPart ? (textPart.text as string) : '';
  // Image data is lost here
}
```

Consumers receive:
```typescript
// What consumers get (missing image)
{
  role: 'user',
  blocks: [{ type: 'text', text: 'Check out this image', ... }]
  // No image block!
}
```

## Solution

### 1. Add `ImageMessageBlock` type

Add a new block type to represent image content:

```typescript
// packages/langgraph-ai-sdk-types/src/index.ts

export interface ImageMessageBlock {
  type: 'image';
  index: number;
  url: string;
  id: string;
}
```

Add to the `MessageBlock` union:

```typescript
export type MessageBlock<T extends LanggraphData<any, any>> =
  T extends any
    ? (
      | TextMessageBlock
      | ImageMessageBlock  // Add this
      | StructuredMessageBlock<T>
      | ToolCallMessageBlock
      | ReasoningMessageBlock
    )
    : never;
```

Also add to `AnyMessageBlock`:

```typescript
export type AnyMessageBlock =
  | TextMessageBlock
  | ImageMessageBlock  // Add this
  | StructuredMessageBlock<any>
  | ToolCallMessageBlock
  | ReasoningMessageBlock;
```

### 2. Update transform function

Modify the user message transformation in `langgraphChat.ts` to extract both text and image_url parts:

```typescript
// packages/langgraph-ai-sdk-react/src/langgraphChat.ts

// Find the function that transforms user messages and update it:

if (msg.role === 'user') {
  const blocks: MessageBlock[] = [];
  let index = 0;

  // Handle array content (multimodal messages)
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
        // Extract URL from either string or object format
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
    // Handle simple string content (non-multimodal)
    blocks.push({
      type: 'text',
      index: 0,
      text: msg.content,
      id: `${msg.id}-text-0`
    });
  }

  return {
    id: msg.id,
    role: msg.role,
    blocks,
    metadata: msg.metadata
  };
}
```

## Files to Modify

| File | Change |
|------|--------|
| `packages/langgraph-ai-sdk-types/src/index.ts` | Add `ImageMessageBlock` interface, update `MessageBlock` and `AnyMessageBlock` unions |
| `packages/langgraph-ai-sdk-react/src/langgraphChat.ts` | Update user message transform to extract `image_url` parts |

## LangChain Message Format Reference

The SDK needs to handle these LangChain content formats:

```typescript
// Format 1: Simple string content
{ type: 'human', content: 'Hello world' }

// Format 2: Array with text only
{ type: 'human', content: [{ type: 'text', text: 'Hello world' }] }

// Format 3: Array with text and images
{
  type: 'human',
  content: [
    { type: 'text', text: 'Check this out' },
    { type: 'image_url', image_url: 'https://example.com/img.png' },  // String format
    { type: 'image_url', image_url: { url: 'https://example.com/img2.png', detail: 'auto' } }  // Object format
  ]
}

// Format 4: Image only (no text)
{
  type: 'human',
  content: [
    { type: 'image_url', image_url: { url: 'https://example.com/img.png' } }
  ]
}
```

## Expected Output

After this change, consumers will receive:

```typescript
// Input (LangChain message)
{
  type: 'human',
  content: [
    { type: 'text', text: 'Check out this image' },
    { type: 'image_url', image_url: { url: 'https://cdn.example.com/photo.jpg' } }
  ]
}

// Output (SDK message with blocks)
{
  id: 'msg-123',
  role: 'user',
  blocks: [
    { type: 'text', index: 0, text: 'Check out this image', id: 'msg-123-text-0' },
    { type: 'image', index: 1, url: 'https://cdn.example.com/photo.jpg', id: 'msg-123-img-1' }
  ]
}
```

## Acceptance Criteria

- [ ] `ImageMessageBlock` type is exported from `langgraph-ai-sdk-types`
- [ ] User messages with `image_url` content blocks produce `ImageMessageBlock` in output
- [ ] Both string and object `image_url` formats are handled
- [ ] Simple string content still works (backwards compatible)
- [ ] Text-only array content still works (backwards compatible)
- [ ] Image-only messages (no text) produce only image blocks
- [ ] Multiple images in one message produce multiple image blocks
- [ ] Block ordering matches content array ordering

## Testing

```typescript
describe('transformMessages', () => {
  it('extracts image_url blocks from multimodal messages', () => {
    const input = {
      type: 'human',
      id: 'msg-1',
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'image_url', image_url: { url: 'https://example.com/img.png' } }
      ]
    };

    const result = transformMessages([input]);

    expect(result[0].blocks).toHaveLength(2);
    expect(result[0].blocks[0]).toEqual({
      type: 'text',
      index: 0,
      text: 'Hello',
      id: 'msg-1-text-0'
    });
    expect(result[0].blocks[1]).toEqual({
      type: 'image',
      index: 1,
      url: 'https://example.com/img.png',
      id: 'msg-1-img-1'
    });
  });

  it('handles string format image_url', () => {
    const input = {
      type: 'human',
      id: 'msg-2',
      content: [
        { type: 'image_url', image_url: 'https://example.com/img.png' }
      ]
    };

    const result = transformMessages([input]);

    expect(result[0].blocks[0].url).toBe('https://example.com/img.png');
  });

  it('preserves backwards compatibility with string content', () => {
    const input = {
      type: 'human',
      id: 'msg-3',
      content: 'Just text'
    };

    const result = transformMessages([input]);

    expect(result[0].blocks).toHaveLength(1);
    expect(result[0].blocks[0].type).toBe('text');
    expect(result[0].blocks[0].text).toBe('Just text');
  });
});
```

## Notes

- This change is backwards compatible - existing consumers that only handle `text` blocks will continue to work
- Consumers that want to display images need to check for `type: 'image'` blocks and render them
- The SDK does not handle image loading, caching, or display - that's the consumer's responsibility
