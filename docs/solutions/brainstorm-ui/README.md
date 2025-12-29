# Brainstorm UI Solutions

Documentation for the Launch10 Brainstorm chat interface implementation.

## Contents

| Document | Description |
|----------|-------------|
| [brainstorm-ui-flow.md](./brainstorm-ui-flow.md) | Complete architecture and implementation guide |
| [patterns.md](./patterns.md) | Quick reference for component patterns |

## Quick Reference

### Key Files

**Components:**
- `rails_app/app/javascript/frontend/components/chat/` - Shared chat components
- `rails_app/app/javascript/frontend/components/brainstorm/` - Brainstorm-specific components

**Store:**
- `rails_app/app/javascript/frontend/stores/brainstormStore.ts` - Central state management

**Tests:**
- `rails_app/app/javascript/frontend/components/chat/__tests__/` - Component tests
- `rails_app/app/javascript/frontend/test/testing-library-patterns.tsx` - Testing patterns

**Stories:**
- `rails_app/stories/chat/` - Storybook stories for chat components

**Backend:**
- `rails_app/app/controllers/api/v1/social_links_controller.rb` - Social links API
- `rails_app/spec/requests/social_links_spec.rb` - API tests

### Related Decisions

See [docs/decisions/](../../decisions/) for architectural decisions:
- [frontend.md](../../decisions/frontend.md) - Compound components, state separation
- [sdk.md](../../decisions/sdk.md) - langgraph-ai-sdk design
- [testing.md](../../decisions/testing.md) - TDD approach

## Commands

```bash
cd rails_app

# Development
pnpm test                 # Run tests
pnpm test:watch           # Watch mode
pnpm storybook            # Visual development on :6006
pnpm lint                 # ESLint check
pnpm typecheck            # TypeScript check

# Before pushing
pnpm test && pnpm lint && pnpm typecheck && pnpm storybook:build
```
