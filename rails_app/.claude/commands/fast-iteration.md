---
name: fast-iteration
description: Guidelines for fast, efficient development iteration cycles
argument-hint: "[optional: test file or feature context]"
---

# Fast Iteration

Principles and practices for maximizing development velocity. Speed comes from tight feedback loops, not rushing.

## Core Philosophy

**Iteration speed beats perfection.** A fast feedback loop that catches errors in 5 seconds beats a comprehensive test suite that takes 2 minutes. When iterating:

1. **Focus your tests** - Run only what's relevant
2. **Use short timeouts** - Fail fast, don't wait
3. **Read your errors** - Don't guess, don't assume
4. **One change at a time** - Isolate variables

## Workflow

### Step 1: Scope Your Iteration

Before running anything, ask:

- What specific behavior am I testing?
- What's the smallest test that would prove this works?
- What's the fastest way to get feedback?

**Anti-pattern:** Running the full test suite after every change
**Pattern:** Running a single focused test or spec

### Step 2: Focus Tests

**Rails/RSpec:**

```bash
# Run single test file
bundle exec rspec spec/models/user_spec.rb

# Run single test by line number
bundle exec rspec spec/models/user_spec.rb:42

# Run tests matching description
bundle exec rspec -e "validates email"

# Run with fail-fast (stop on first failure)
bundle exec rspec --fail-fast spec/models/user_spec.rb
```

**Jest/Vitest:**

```bash
# Run single test file
pnpm test path/to/file.test.ts

# Run tests matching pattern
pnpm test -t "should validate"

# Watch mode for instant feedback
pnpm test --watch path/to/file.test.ts
```

**Playwright E2E:**

```bash
# Run single test file
pnpm test:e2e tests/specific.spec.ts

# Run specific test by title
pnpm test:e2e -g "user can login"

# Run in headed mode for debugging
pnpm test:e2e --headed tests/specific.spec.ts
```

### Step 3: Use Aggressive Timeouts

Don't wait for things to time out naturally. Set short timeouts to fail fast:

```bash
# Bash commands - use timeout
timeout 30 bundle exec rspec spec/models/

# Or with the Bash tool, use the timeout parameter
```

### Step 4: Read Your Errors (Don't Assume)

**CRITICAL:** When a test fails, READ THE ERROR MESSAGE before changing code.

**Anti-patterns:**

- "That test is flaky, let me re-run it"
- "I think I know what's wrong" (without reading the error)
- Making multiple changes before seeing what failed

**Pattern:**

1. Read the full error message
2. Read the stack trace
3. Identify the exact line that failed
4. Understand WHY before changing anything

**Error Reading Checklist:**

- [ ] What exception or assertion failed?
- [ ] What was expected vs. actual?
- [ ] What line in the test failed?
- [ ] What line in the code caused it?

### Step 5: One Change at a Time

When debugging or iterating:

1. Make ONE change
2. Run the focused test
3. Observe the result
4. If it fails, revert and try something different
5. If it passes, move to the next change

**Anti-pattern:**

```
# Make 5 changes, run tests, something fails
# Now you don't know which change broke it
```

**Pattern:**

```
# Change 1 → test → pass
# Change 2 → test → fail → revert → understand why
# Change 2 (fixed) → test → pass
# Change 3 → test → pass
```

### Step 6: Use the Right Feedback Tool

Match your feedback mechanism to what you're checking:

| What You're Testing | Fastest Feedback                 |
| ------------------- | -------------------------------- |
| Ruby syntax/logic   | `ruby -c file.rb` (syntax check) |
| Rails model logic   | Single RSpec model spec          |
| Controller behavior | Single request spec              |
| React component     | Jest unit test                   |
| Full user flow      | Single Playwright test           |
| Visual appearance   | Playwright screenshot            |
| API response        | `curl` or single request spec    |
| Type errors         | `pnpm typecheck`                 |
| Lint issues         | `bundle exec rubocop file.rb`    |

### Step 7: Parallelize When Possible

When running multiple independent checks, use parallel tool calls:

```bash
# These can run in parallel (no dependencies)
bundle exec rubocop app/models/user.rb
bundle exec rspec spec/models/user_spec.rb
pnpm typecheck
```

```bash
# These must be sequential (dependencies)
bundle exec rails db:migrate
bundle exec rspec  # depends on migration
```

## Common Scenarios

### "My test is failing and I don't know why"

1. Run ONLY that test: `rspec spec/file_spec.rb:LINE`
2. Read the FULL error output
3. Add `binding.pry` before the failing line
4. Run again and inspect state
5. Don't change code until you understand the failure

### "Tests pass locally but fail in CI"

1. Check if it's a timing issue (add small waits, check for race conditions)
2. Check environment differences (ENV vars, database state)
3. Run with `--seed` to match CI's test order
4. Check for test pollution (tests affecting each other)

### "I'm not sure if my change worked"

1. Write a failing test FIRST that proves the behavior you want
2. Make your change
3. Watch the test pass
4. You now have proof it works

### "The test suite is too slow"

1. Identify slow tests: `rspec --profile 10`
2. Run only affected tests during development
3. Use `--fail-fast` to stop at first failure
4. Save full suite for final verification

## Success Criteria

- [ ] Running focused tests, not full suite
- [ ] Feedback loop under 10 seconds
- [ ] Reading errors before making changes
- [ ] One change per iteration
- [ ] Understanding WHY something fails before fixing

## Remember

> "If you're waiting more than 10 seconds for feedback, you're doing it wrong."

Speed comes from:

1. **Focus** - Test only what you changed
2. **Discipline** - Read errors, don't guess
3. **Isolation** - One change at a time
4. **Appropriate tools** - Match the check to the change
