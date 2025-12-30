---
status: done
priority: p1
issue_id: "001"
tags: [code-review, architecture, pattern-consistency, brainstorm-ui]
dependencies: []
---

# Missing View/Container Pattern in Brainstorm Components

## Problem Statement

Brainstorm components (BrainstormMessages, BrainstormInput) do not follow the View/Container separation pattern that Campaign components use (AdsChatMessagesView/AdsChatMessages, AdsChatInputView/AdsChatInput). This inconsistency:
- Makes unit testing difficult (must mock hooks instead of passing props)
- Prevents Storybook isolation
- Reduces reusability
- Creates cognitive overhead when switching between features

## Findings

### Campaign Pattern (Canonical)
```typescript
// AdsChatMessages.tsx - separates View from Container
export function AdsChatMessagesView({ messages, isLoading }: Props) { ... }
export default function AdsChatMessages() {
  const messages = useAdsChatMessages();
  return <AdsChatMessagesView messages={messages} ... />;
}
```

### Brainstorm Pattern (Missing View Separation)
```typescript
// BrainstormMessages.tsx - combines data fetching and rendering
export function BrainstormMessages() {
  const messages = useBrainstormChatMessages();
  // ...rendering logic directly in component
}
```

**Affected files:**
- `app/javascript/frontend/components/brainstorm/BrainstormMessages.tsx`
- `app/javascript/frontend/components/brainstorm/BrainstormInput.tsx`

## Proposed Solutions

### Option 1: Add View Components (Recommended)
Create `BrainstormMessagesView` and `BrainstormInputView` components:

```typescript
// BrainstormMessages.tsx
export interface BrainstormMessagesViewProps {
  messages: Message[];
  onExampleClick: (text: string) => void;
  onCommandClick: (command: CommandName) => void;
  availableCommands: CommandName[];
  isStreaming: boolean;
}

export function BrainstormMessagesView({ messages, ... }: BrainstormMessagesViewProps) {
  // Pure presentation logic
}

export function BrainstormMessages() {
  const messages = useBrainstormChatMessages();
  const { sendMessage } = useBrainstormChatActions();
  // ...
  return <BrainstormMessagesView messages={messages} ... />;
}
```

**Pros:** Consistent with Campaign, enables isolated testing
**Cons:** Requires refactoring existing code
**Effort:** Medium
**Risk:** Low

### Option 2: Document Why Pattern Differs
If BrainstormMessages has legitimate reasons for a different pattern (e.g., complex attachment handling), document the decision.

**Pros:** No code changes needed
**Cons:** Does not resolve testing difficulty, inconsistency remains
**Effort:** Small
**Risk:** None

## Recommended Action

Option 1 - Add View components to match Campaign pattern.

## Technical Details

**Affected files:**
- `app/javascript/frontend/components/brainstorm/BrainstormMessages.tsx`
- `app/javascript/frontend/components/brainstorm/BrainstormInput.tsx`

**Components to create:**
- `BrainstormMessagesView`
- `BrainstormInputView`

## Acceptance Criteria

- [x] `BrainstormMessagesView` exists and accepts messages as props
- [x] `BrainstormInputView` exists and accepts input state as props
- [x] Container components (`BrainstormMessages`, `BrainstormInput`) delegate to View components
- [x] Both View components can be rendered in Storybook without mocking hooks
- [x] Unit tests for View components use props, not hook mocks

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-30 | Created | Identified during code review |
| 2025-12-30 | Approved | Triage: Ready to work on |
| 2025-12-30 | Completed | Implemented View/Container pattern for both components |

## Resolution Summary

Implemented the View/Container pattern for both `BrainstormMessages` and `BrainstormInput` components:

### BrainstormMessages.tsx
- Created `BrainstormMessagesViewProps` interface with all props needed for rendering
- Created `BrainstormMessagesView` pure presentation component
- Refactored `BrainstormMessages` to act as container, delegating rendering to the View component

### BrainstormInput.tsx
- Created `BrainstormInputViewProps` interface with all input-related props
- Created `BrainstormInputView` pure presentation component
- Refactored `BrainstormInput` to act as container, managing hooks and passing props to View

Both View components are now testable in isolation without mocking hooks, and can be used in Storybook.

## Resources

- Campaign pattern: `app/javascript/frontend/components/ads/sidebar/ads-chat/AdsChatMessages.tsx`
- Pattern recognition specialist report
- Architecture strategist report
