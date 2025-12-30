---
status: done
priority: p1
issue_id: "002"
tags: [code-review, pattern-consistency, forms, brainstorm-ui]
dependencies: []
---

# Form Handling Pattern Inconsistency

## Problem Statement

BrainstormInput uses direct state management (zustand store + manual handlers) while AdsChatInput uses react-hook-form with zod validation. This creates two different form handling paradigms in the codebase, requiring developers to context-switch between patterns.

## Findings

### Campaign Pattern (react-hook-form + zod)
```typescript
// AdsChatInput.tsx
const messageSchema = z.object({ message: z.string().min(1) });

export function AdsChatInputView({ onSubmit }: Props) {
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(messageSchema)
  });
  // Schema-based validation
}
```

### Brainstorm Pattern (direct state)
```typescript
// BrainstormInput.tsx
export function BrainstormInput() {
  const { input, setInput, attachments } = useBrainstormInput();
  const canSubmit = input.trim() || attachments.length > 0;
  // Manual validation logic
}
```

**Key differences:**
| Aspect | Campaign | Brainstorm |
|--------|----------|------------|
| Form library | react-hook-form | None |
| Validation | zod schema | Manual checks |
| State | useForm hook | zustand store |
| View separation | Yes | No |

## Proposed Solutions

### Option 1: Adopt react-hook-form for BrainstormInput (Recommended for consistency)
Refactor BrainstormInput to use react-hook-form with zod, keeping attachment handling in zustand.

```typescript
const brainstormSchema = z.object({
  message: z.string(),
  attachments: z.array(attachmentSchema).optional(),
});

export function BrainstormInputView({ onSubmit, attachments, onAddFiles }: Props) {
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(brainstormSchema)
  });
  // ...
}
```

**Pros:** Consistent with Campaign, schema-based validation
**Cons:** Moderate refactoring effort, attachment handling adds complexity
**Effort:** Medium
**Risk:** Medium (attachments complicate form state)

### Option 2: Document the Pattern Difference
Keep current implementation but document WHY brainstorm uses a different pattern (attachments make react-hook-form awkward).

**Pros:** No code changes, documents intentional decision
**Cons:** Inconsistency remains, testing approaches differ
**Effort:** Small
**Risk:** None

### Option 3: Standardize on zustand for all chat inputs
Refactor AdsChatInput to use zustand store pattern like BrainstormInput.

**Pros:** Consistency achieved
**Cons:** Loses react-hook-form benefits, regression risk in working code
**Effort:** Medium
**Risk:** High (changing working Campaign code)

## Recommended Action

Option 2 - Document the difference. The attachment handling in BrainstormInput makes react-hook-form awkward, and the current implementation works. Add a comment explaining the pattern choice.

## Technical Details

**File:** `app/javascript/frontend/components/brainstorm/BrainstormInput.tsx`

**Add documentation:**
```typescript
/**
 * BrainstormInput uses direct zustand state instead of react-hook-form
 * (unlike AdsChatInput) because:
 * 1. Attachment handling requires async upload tracking
 * 2. Message + attachments form complex submission logic
 * 3. Schema validation is less valuable for freeform chat input
 */
```

## Acceptance Criteria

- [x] Decision documented in code comments
- [ ] Pattern difference noted in frontend architecture docs (if they exist)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-30 | Created | Identified during code review |
| 2025-12-30 | Approved | Triage: Document pattern difference (async uploads make RHF awkward) |
| 2025-12-30 | Completed | Added JSDoc comment to BrainstormInput.tsx explaining the pattern choice |

## Resources

- Campaign input: `app/javascript/frontend/components/ads/sidebar/ads-chat/AdsChatInput.tsx`
- Brainstorm input: `app/javascript/frontend/components/brainstorm/BrainstormInput.tsx`
