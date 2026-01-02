---
status: complete
priority: p2
issue_id: "003"
tags: [inertia, routing, state-management]
dependencies: []
---

# Investigate Inertia router.replace for URL Updates

## Problem Statement
The `useBrainstormChat` hook uses `window.history.pushState` directly to update the URL when a new thread is created. This bypasses Inertia's router, which could cause back button inconsistencies and conflicts with Inertia's history handling.

## Context
pushState was intentionally chosen to keep the stream ongoing from the backend, since it gets started on the first page and redirected. The concern is whether Inertia's router can achieve the same without breaking the stream.

## Findings
- Location: `app/javascript/frontend/hooks/useBrainstormChat.ts:27-31`
- Current code: `window.history.pushState({ threadId }, "", newUrl)`
- Bypasses Inertia's router entirely
- Back button behavior may be inconsistent
- React/Inertia state may not know URL changed

## Proposed Solutions

### Option 1: Use Inertia router.replace with preserveState
- **Pros**: Proper Inertia integration, correct back button behavior
- **Cons**: May interrupt stream if it triggers a request
- **Effort**: Medium (2-4 hours to test)
- **Risk**: Medium - could break streaming

### Option 2: Keep pushState but document the tradeoff
- **Pros**: No risk to existing functionality
- **Cons**: Back button issues remain
- **Effort**: Small (30 min)
- **Risk**: Low

## Recommended Action
Test `router.replace({ url: newUrl, preserveState: true, preserveScroll: true })` to see if it keeps the stream alive. If it works, migrate. If not, document why pushState is necessary.

## Technical Details
- **Affected Files**: `app/javascript/frontend/hooks/useBrainstormChat.ts`
- **Related Components**: BrainstormConversationPage, all streaming components
- **Database Changes**: No

## Testing Required
1. Start new brainstorm conversation
2. Send first message (stream starts)
3. Verify URL updates without interrupting stream
4. Test back button behavior
5. Test forward button behavior
6. Test page refresh at new URL

## Resources
- Original finding: Chat component refactor code review
- Inertia docs: https://inertiajs.com/manual-visits

## Acceptance Criteria
- [ ] Investigated router.replace behavior with active streams
- [ ] Either migrated to router.replace OR documented why pushState is necessary
- [ ] Back button behavior is acceptable
- [ ] Stream not interrupted during URL update
- [ ] Tests pass

## Work Log

### 2026-01-01 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status set to ready
- Ready to be picked up and worked on

**Learnings:**
- Need to balance framework conventions with functional requirements

## Notes
Source: Triage session on 2026-01-01
