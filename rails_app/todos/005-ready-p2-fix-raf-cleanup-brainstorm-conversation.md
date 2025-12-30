---
status: completed
priority: p2
issue_id: "005"
tags: [code-review, performance, memory-leak, brainstorm-ui]
dependencies: []
---

# Fix requestAnimationFrame Cleanup in BrainstormConversation

## Problem Statement

In `BrainstormConversation.tsx`, the `requestAnimationFrame` callback is not cleaned up on unmount. If the component unmounts during the rAF wait, `setContentVisible(true)` will be called on an unmounted component, causing a React warning.

## Findings

**File:** `app/javascript/frontend/components/brainstorm/BrainstormConversation.tsx`

**Current code (lines 143-146):**
```typescript
// Small delay to trigger CSS transition
requestAnimationFrame(() => {
  setContentVisible(true);
});
```

**Problem:** No cleanup for the rAF callback. Timer ref is cleaned up but rAF is not.

## Proposed Solutions

### Option 1: Add rAF Cleanup (Recommended)

```typescript
useEffect(() => {
  let rafId: number | undefined;

  if (isLoading) {
    skeletonTimerRef.current = setTimeout(() => {
      setShowSkeleton(true);
    }, SKELETON_DELAY_MS);
    setContentVisible(false);
  } else {
    if (skeletonTimerRef.current) {
      clearTimeout(skeletonTimerRef.current);
      skeletonTimerRef.current = null;
    }
    setShowSkeleton(false);
    rafId = requestAnimationFrame(() => {
      setContentVisible(true);
    });
  }

  return () => {
    if (skeletonTimerRef.current) {
      clearTimeout(skeletonTimerRef.current);
    }
    if (rafId !== undefined) {
      cancelAnimationFrame(rafId);
    }
  };
}, [isLoading]);
```

**Pros:** Prevents React warning, proper cleanup
**Cons:** None
**Effort:** Small (5 minutes)
**Risk:** None

## Recommended Action

Add rAF cleanup.

## Technical Details

**File:** `app/javascript/frontend/components/brainstorm/BrainstormConversation.tsx`
**Lines:** 129-154

## Acceptance Criteria

- [x] `cancelAnimationFrame` called in cleanup function
- [x] No React warnings about state updates on unmounted components

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-30 | Created | Identified during performance review |
| 2025-12-30 | Approved | Triage approved - status: ready |
| 2025-12-30 | Completed | Added rafId variable and cancelAnimationFrame cleanup |

## Resources

- Performance oracle report
