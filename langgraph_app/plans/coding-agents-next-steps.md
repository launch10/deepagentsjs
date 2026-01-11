# Coding Agent & Deploy System: MVP Plan

## Executive Summary

Simplified plan based on 3 parallel reviews (DHH, Kieran, Simplicity). Focus on **user outcomes, not implementation details**.

---

## Current State vs MVP Requirements

### Coding Agent

| Capability | Status | Gap |
|-----------|--------|-----|
| Brainstorm context (idea, audience, solution) | Done | - |
| Theme colors (6-color palette) | Done | - |
| Typography recommendations | Done | - |
| User's images/logos | Partial | Needs prompt guidance |
| React/TypeScript + shadcn/ui | Done | - |
| SearchIcons tool | Done | - |
| L10.createLead integration | Partial | Needs prompt clarity |
| React Router navigation | Needs Work | Needs prompt guidance |

### Deploy System

| Capability | Status | Gap |
|-----------|--------|-----|
| Runtime validation (Playwright) | Done | - |
| Bug fix via coding agent | Done | **Bug: silent error swallowing** |
| Instrumentation check | Partial | Uses fragile string matching |
| Cloudflare deployment | Done | - |
| Google Ads campaign | Done | - |

---

## Phase 1: Bug Fixes

### 1a. Fix bugFixNode Silent Error Swallowing

**File:** `app/nodes/deploy/bugFixNode.ts` (lines 79-82)

```typescript
// BEFORE: Silently swallows errors
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  return {};  // BUG: Should mark task as failed
}

// AFTER: Mark task as failed
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  return {
    tasks: [{ ...task, status: "failed", error: errorMessage } as Task.Task],
  };
}
```

### 1b. Refactor instrumentationNode to use codingAgent

**File:** `app/nodes/deploy/instrumentationNode.ts`

Replace custom LLM logic with `createCodingAgent()`:

```typescript
const instrumentationSystemPrompt = `
You are a pre-deployment agent. Add Google Ads conversion tracking to the PRIMARY conversion form.

Tasks:
1. Find the primary conversion form (signup, waitlist, purchase, lead capture)
2. Import L10 from '@/lib/tracking' if not already imported
3. Add L10.conversion({ label: '<type>' }) after successful form submission

Labels: "signup" | "lead" | "purchase" | "download"

Rules:
- Only instrument ONE primary conversion per page
- Fire on SUCCESS (after API success, before thank you state)
`;
```

---

## Phase 2: Prompt Improvements

Quick wins (< 1 hour total) that improve agent reliability.

### 2a. React Router Guidance

**File:** `app/prompts/coding/shared/workflow.ts`

```markdown
## Navigation Patterns

For in-page navigation (anchor links):
- Use <a href="#section-id"> with matching id on target element
- Example: <a href="#features"> links to <section id="features">

For multi-page navigation (if needed):
- Use React Router's Link component: <Link to="/about">
- Define routes in src/App.tsx
```

### 2b. L10.createLead Clarity

**File:** `app/prompts/coding/shared/tracking.ts`

```markdown
## Lead Capture Requirements

EVERY landing page MUST include email capture:

1. Import: import { L10 } from '@/lib/tracking'
2. On form submit success:
   - Simple signup: await L10.createLead(email)
   - Tiered pricing: await L10.createLead(email, { value: selectedPrice })
3. Show success state AFTER L10.createLead resolves
4. Handle errors gracefully (show "Try again" message)
```

### 2c. Image Usage Guidance

**File:** `app/prompts/coding/shared/context.ts`

```markdown
## Using Uploaded Images

Images are available in the context. Use them:
- Logo (isLogo: true) → Header/Footer, favicon area
- Hero images → Hero section background or side image
- Product images → Features, testimonials, gallery

Use actual image URLs from context, don't use placeholders.
```

---

## Phase 3: Outcome-Based Tests

**8 tests in 2 files**, organized by user outcome (not implementation).

### File 1: `tests/tests/graphs/codingAgent/integration.test.ts`

| Test | User Outcome |
|------|--------------|
| `generates complete landing page` | Hero, Features, Pricing present with theme colors |
| `lead capture works` | L10.createLead called with email (+ optional value) |
| `navigation links work` | Anchor links resolve to sections |
| `uses user's uploaded images` | Logo/images appear in generated components |

### File 2: `tests/tests/graphs/deploy/deploy.test.ts`

| Test | User Outcome |
|------|--------------|
| `deploy succeeds for valid page` | Clean page deploys without errors |
| `deploy catches errors and fixes them` | Errors detected → passed to agent → fixed |
| `deploy fails after max retries` | 2 failed fixes → deployment marked failed |
| `instrumentation adds conversion tracking` | L10.conversion present after deploy prep |

### Test Fixture

**One snapshot:** `website_complete`
- Brainstorm context (idea, audience, solution)
- Theme colors (6-color palette)
- Uploaded images (logo + hero image)
- Signup form (for lead capture testing)

Create additional snapshots only when tests fail due to needing isolation.

---

## Files to Modify

| File | Change |
|------|--------|
| `app/nodes/deploy/bugFixNode.ts` | Fix silent error swallowing |
| `app/nodes/deploy/instrumentationNode.ts` | Refactor to use createCodingAgent |
| `app/prompts/coding/shared/workflow.ts` | Add React Router guidance |
| `app/prompts/coding/shared/tracking.ts` | Add L10.createLead clarity |
| `app/prompts/coding/shared/context.ts` | Add image usage guidance |
| `tests/tests/graphs/codingAgent/integration.test.ts` | Enable + add tests |
| `tests/tests/graphs/deploy/deploy.test.ts` | NEW: Deploy outcome tests |
| `tests/fixtures/database/snapshots/website_complete.json` | NEW: Comprehensive snapshot |

---

## Verification

```bash
# 1. Fix bugFixNode, run existing tests
pnpm test tests/tests/nodes/deploy/bugFixNode.test.ts

# 2. Refactor instrumentationNode
pnpm test tests/tests/nodes/deploy/instrumentationNode.test.ts

# 3. Run integration tests
pnpm test tests/tests/graphs/codingAgent/integration.test.ts

# 4. Run deploy tests
pnpm test tests/tests/graphs/deploy/deploy.test.ts

# 5. Manual E2E
# - Create website from brainstorm
# - Verify theme colors, images, lead capture present
# - Deploy successfully
# - Submit test lead
```

---

## ClickUp Alignment

From "Production-grade Coding Agent + Tests" (MVP, Urgent):

| ClickUp Task | Plan Coverage |
|--------------|---------------|
| Ensure links work | Phase 2a (React Router guidance) |
| Add logos and images | Phase 2c (Image guidance) + Test |
| Add user's theme | Already done + Test |
| Search for icons | Already done |
| Agent integrates with email signups API | Phase 2b (L10.createLead) + Test |
| Add tests for agent + page creation | Phase 3 (8 tests) |
| Coding agent guardrails | Deferred to post-MVP |

---

## What's NOT in MVP (Deferred)

- Guardrail tests (hardcoded colors, external libraries, file size limits)
- Multiple database snapshots (start with 1, split if needed)
- Test helper abstractions (use inline assertions)
- Separate test files per node (consolidate by outcome)

---

## Summary

| Metric | Value |
|--------|-------|
| Tests | 8 |
| Test files | 2 |
| Snapshots | 1 |
| Prompt files to update | 3 |
| Bug fixes | 2 |
| Estimated time | 2-3 days |
