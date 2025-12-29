# Running Tests

## Quick Reference

| What | Command | Location |
|------|---------|----------|
| All tests (both apps) | `pnpm run test:all` | Root |
| Rails tests only | `pnpm run test:rails` | Root |
| Langgraph tests only | `pnpm run test:langgraph` | Root |
| Specific Rails spec | `bundle exec rspec spec/path/to_spec.rb` | rails_app |
| Specific Langgraph test | `pnpm run test -- path/to/test.ts` | langgraph_app |

## Rails Tests (RSpec)

```bash
cd rails_app

# Run all specs
bundle exec rspec

# Run a specific file
bundle exec rspec spec/models/user_spec.rb

# Run a specific line
bundle exec rspec spec/models/user_spec.rb:42

# Run with tag
bundle exec rspec --tag focus

# Run request specs only
bundle exec rspec spec/requests/
```

## Langgraph Tests (Vitest)

```bash
cd langgraph_app

# Run all tests
pnpm run test

# Run specific test file
pnpm run test -- tests/graphs/brainstorm/brainstorm.test.ts

# Run in watch mode
pnpm run test -- --watch

# Run with verbose output
pnpm run test -- --reporter=verbose
```

## Using Polly (HTTP Recording)

Langgraph tests use Polly to record and replay HTTP responses:

```typescript
// Tests automatically record AI API responses
// Replayed responses = deterministic, fast, free tests
testGraph()
  .withGraph(brainstormGraph)
  .withPrompt("Help me brainstorm")
  .execute();
```

Recordings stored in `langgraph_app/tests/__recordings__/`

## Using Snapshots

For tests that need database state:

```typescript
testGraph()
  .withSnapshot("basic_account")  // Restore DB state first
  .withPrompt("Create a landing page")
  .execute();
```

See `database-snapshots.md` skill for more details.

## Linting

```bash
# All linting
pnpm run lint:all

# Rails only (Rubocop)
pnpm run lint:rails
# or
cd rails_app && bundle exec rubocop

# Langgraph only (ESLint + TypeScript)
pnpm run lint:langgraph
# or
cd langgraph_app && pnpm run lint && pnpm run typecheck
```

## Pre-push Checks

Before pushing, the pre-push hook runs:
1. Generates Swagger docs
2. Generates TypeScript types
3. Fails if generated files have uncommitted changes

Run manually:
```bash
./scripts/prepush.sh
```
