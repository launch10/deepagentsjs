# Plan: Enable Polly.js Recording/Replay in Development Mode

## Goal

Enable HTTP caching/replay in development to avoid 4-5 minute waits for AI model responses when debugging the frontend website builder.

## Approach

Add a `POLLY_MODE` environment variable that enables Polly in development mode with three options:

- `off` (default) - Normal HTTP requests, no Polly
- `record` - Record all HTTP interactions to disk
- `replay` - Replay from existing recordings

## Files to Modify

1. **`app/core/env.ts`** - Add `POLLY_MODE` to environment schema
2. **`app/utils/polly.ts`** - Add dev recordings directory support
3. **`app/core/node/middleware/withPolly.ts`** - Enable middleware in dev mode based on `POLLY_MODE`
4. **`package.json`** - Add convenience npm scripts
5. **`.gitignore`** - Ignore dev recordings directory

## Implementation Steps

### Step 1: Update Environment Schema

**File:** `app/core/env.ts`

Add `POLLY_MODE` to the base env schema:

```typescript
POLLY_MODE: z.enum(["off", "record", "replay"]).default("off"),
```

### Step 2: Update PollyManager for Dev Mode

**File:** `app/utils/polly.ts`

Add:

- `DEV_RECORDINGS_DIR` constant pointing to `dev/recordings/`
- `getRecordingsDir()` method that returns appropriate directory
- Update `hardStartPolly` to use dynamic recordings directory

```typescript
static DEV_RECORDINGS_DIR = path.join(process.cwd(), "dev", "recordings");

static getRecordingsDir(): string {
  const env = process.env.NODE_ENV;
  return env === "test" ? PollyManager.RECORDINGS_DIR : PollyManager.DEV_RECORDINGS_DIR;
}
```

### Step 3: Update withPolly Middleware

**File:** `app/core/node/middleware/withPolly.ts`

Change the early return condition from checking `NODE_ENV` to checking `POLLY_MODE`:

```typescript
export const withPolly = <TState extends CoreGraphState>(
  nodeFunction: NodeFunction<TState>,
  options: WithPollyConfig
): NodeFunction<TState> => {
  return async (state: TState, config: LangGraphRunnableConfig) => {
    // Test mode: always use Polly (existing behavior)
    // Dev mode: only if POLLY_MODE is record or replay
    const shouldUsePolly =
      env.NODE_ENV === "test" || (env.NODE_ENV === "development" && env.POLLY_MODE !== "off");

    if (!shouldUsePolly) {
      return nodeFunction(state, config);
    }

    // Determine mode
    const mode = env.NODE_ENV === "test" ? "replay" : (env.POLLY_MODE as "record" | "replay");

    const nodeCtx = getNodeContext();
    const nodeName = nodeCtx?.name || "unknown-node-execution";
    const recordingName = kebabCase(nodeName);

    await startPolly(recordingName, mode);
    // ... rest unchanged
  };
};
```

### Step 4: Add NPM Scripts

**File:** `package.json`

```json
"dev:record": "POLLY_MODE=record pnpm run dev",
"dev:replay": "POLLY_MODE=replay pnpm run dev",
"dev:clean-recordings": "rm -rf dev/recordings"
```

### Step 5: Update .gitignore

**File:** `.gitignore`

```
# Dev recordings (not committed)
dev/recordings/
```

## Developer Workflow

1. **Record a session:**

   ```bash
   pnpm dev:record
   ```

   Interact with the frontend to trigger website generation. HTTP responses are saved.

2. **Replay for rapid debugging:**

   ```bash
   pnpm dev:replay
   ```

   AI responses come from cache instantly. Debug frontend without waiting.

3. **Clean and re-record:**
   ```bash
   pnpm dev:clean-recordings
   pnpm dev:record
   ```

## Verification

1. Start with `pnpm dev:record`, trigger a website build, verify `dev/recordings/` contains HAR files
2. Stop server, restart with `pnpm dev:replay`, trigger same flow, verify instant responses
3. Run existing tests with `pnpm test` to ensure no regressions
4. Verify normal `pnpm dev` (POLLY_MODE=off) works without Polly

## Design Decisions

**Why separate dev recordings directory?**

- Test recordings are tightly coupled to specific test scenarios and database state
- Dev recordings may have different data and are more ad-hoc
- Keeps test recordings clean and version-controlled
- Dev recordings can be gitignored and ephemeral

**Why node-level recording names in dev mode?**

- Matches existing test behavior
- Each node gets its own recording file
- Consistent with how `withPolly` middleware works
