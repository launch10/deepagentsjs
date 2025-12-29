# Pull Request Template

## Description
Brief description of the changes in this PR.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Component enhancement
- [ ] Test improvements
- [ ] Documentation
- [ ] Refactoring

## Related Issue
Closes #(issue number) or N/A

---

## Component Development Checklist

> Required for any new React components or component modifications

### Architecture & Patterns
- [ ] Component follows **compound component pattern** (no excessive boolean props)
- [ ] Types properly separated (graph state vs Rails API data)
- [ ] No direct store mutations in components (only in store files)
- [ ] Uses `langgraph-ai-sdk` hooks instead of manual message syncing
- [ ] Props interface documented with JSDoc

### Testing
- [ ] Test file created (`.test.tsx`)
- [ ] Tests cover all sub-components in isolation
- [ ] Tests cover compound composition scenarios
- [ ] Tests cover all state variants (loading, error, empty, active, inactive)
- [ ] Test coverage maintained or improved (`pnpm test:coverage`)
- [ ] Run locally and passes: `pnpm test`

### Visual & Stories
- [ ] Storybook story file created (`.stories.tsx`)
- [ ] Story documents each sub-component
- [ ] Stories for all state variants included
- [ ] Composition examples shown in stories
- [ ] Storybook builds without errors: `pnpm storybook:build`

### Code Quality
- [ ] No console warnings/errors in dev or tests
- [ ] TypeScript types strict (no `any`)
- [ ] Uses `twMerge` for Tailwind class merging
- [ ] Markdown rendering uses `ReactMarkdown` where needed
- [ ] ESLint passes: `pnpm lint`
- [ ] Typecheck passes: `pnpm typecheck`

---

## Data Flow Checklist

> Required for features involving Langgraph or store state

### Graph State vs Rails Data
- [ ] Graph state mutations only in `updateFromGraph()`
- [ ] Rails data (project metadata, settings) not mixed with graph state
- [ ] Clear type separation in store (BrainstormGraphState vs InertiaProps)
- [ ] Hydration happens once (using `useRef` pattern)
- [ ] Store selectors used for all derived state

### Message Handling
- [ ] Using `langgraph-ai-sdk` hooks for messages
- [ ] Message blocks properly typed (TextMessageBlock, StructuredMessageBlock, etc.)
- [ ] Tool calls rendered with BlockRenderer pattern
- [ ] Reasoning blocks handled if applicable
- [ ] Empty/loading states handled gracefully

### Routing & Navigation
- [ ] Client-side UUID generation if creating new projects
- [ ] Redirect logic properly clearing state
- [ ] No stale data issues between pages
- [ ] Thread ID properly managed in store

---

## Testing & Verification

- [ ] Unit tests pass: `pnpm test`
- [ ] Visual changes verified in Storybook: `pnpm storybook`
- [ ] Integration tested locally with full app running
- [ ] No console errors in browser DevTools
- [ ] Network requests validated (JWT, message payloads)

### Tested Scenarios
- [ ] Normal case (happy path)
- [ ] Loading state
- [ ] Error handling
- [ ] Empty state
- [ ] Edge cases specific to feature

---

## Documentation

- [ ] Component JSDoc complete
- [ ] Compound sub-components documented
- [ ] Usage examples in test or story files
- [ ] README updated if creating new feature area
- [ ] PREVENTION_STRATEGIES.md updated if establishing new pattern

---

## Files Changed Summary

**Components**:
- [ ] (list files)

**Tests**:
- [ ] (list files)

**Stories**:
- [ ] (list files)

**Stores/State**:
- [ ] (list files)

---

## Review Notes

Any additional context for reviewers?

---

## Checklist for Reviewers

> Reviewer: Verify these patterns are maintained

- [ ] No boolean-only component props (max 2)
- [ ] Tests exist and cover key scenarios
- [ ] Storybook stories document composition
- [ ] Graph state / Rails data properly separated
- [ ] No direct store mutations in components
- [ ] SDK hooks used for message handling
- [ ] Type system enforced (no `any`)
- [ ] Code follows existing patterns in codebase

If any items are unchecked, please request changes before approving.
