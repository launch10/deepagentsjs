# feat: Enable Polly.js for Langgraph Server in E2E Tests

## Overview

Enable Polly.js HTTP recording/replay for the Langgraph server during Playwright E2E tests by **reusing the existing `withPolly` node middleware**.

## Problem Statement

- Playwright tests run against Rails + Vite via `Procfile.test`
- **Langgraph server is not started** during E2E tests
- Tests make real LLM API calls - slow, costly, flaky

## Solution

The `withPolly` middleware at `langgraph_app/app/core/node/middleware/withPolly.ts` already:

1. Checks `NODE_ENV === "test"` (line 20)
2. Gets node name from context (line 25)
3. Calls `startPolly(recordingName)` with per-node isolation (line 28)
4. Persists recordings after each node (line 35)

**We just need to start Langgraph with `NODE_ENV=test`.**

## Implementation

**Edit `rails_app/Procfile.test`:**

```procfile
web: RAILS_ENV=test bundle exec rails server -p $PORT
vite: RAILS_ENV=test bin/vite dev
langgraph: cd ../langgraph_app && NODE_ENV=test pnpm run dev
```

**Done.**

## Files Changed

| File | Change |
|------|--------|
| `rails_app/Procfile.test` | Add 1 line |

**New files: 0**
**Lines added: 1**

## How It Works

```
Playwright Test
    ↓
Rails (port 3001)
    ↓
Langgraph (port 8080, NODE_ENV=test)
    ↓
Node executes with withPolly middleware
    ↓
startPolly("kebab-node-name") called automatically
    ↓
LLM calls recorded/replayed per-node
    ↓
Recordings: langgraph_app/tests/recordings/{node-name}_*/recording.har
```

## Recording Management

**Initial recording (first run):**
```bash
cd rails_app
bin/dev-test  # Starts all servers with NODE_ENV=test
npx playwright test  # Polly records missing requests automatically
```

**Re-record after changes:**
```bash
rm -rf ../langgraph_app/tests/recordings/*
npx playwright test
```

## Acceptance Criteria

- [ ] `bin/dev-test` starts Rails, Vite, AND Langgraph
- [ ] Langgraph runs with `NODE_ENV=test`
- [ ] `withPolly` middleware activates automatically
- [ ] Per-node recording isolation (same as unit tests)
- [ ] Existing unit test recordings still work

## Why This Works

The `withPolly` middleware was designed for exactly this use case. It wraps every LLM-calling node and:

- Only activates when `NODE_ENV=test`
- Uses node name for recording isolation
- Handles recording persistence automatically

We were overcomplicating this. The infrastructure already exists.
