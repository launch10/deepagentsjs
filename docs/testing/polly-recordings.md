# Polly.js Recordings

Polly.js records and replays HTTP requests for deterministic Langgraph agent testing without live API calls. Recordings are stored as HAR files on disk. In development, unmatched requests hit real APIs and get recorded. In CI, only replayed recordings are used — unmatched requests fail immediately.

## How It Works

```
Local Development (recordIfMissing: true):
  Test → HTTP request → Polly intercepts
       │
       ├─ Match in HAR? → Yes → Return cached response ($0)
       └─ No match → Forward to real API → Record response → Save to HAR

CI Environment (recordIfMissing: false):
  Test → HTTP request → Polly intercepts
       │
       ├─ Match in HAR? → Yes → Return cached response ($0)
       └─ No match → Error (test fails)
```

## Configuration

```typescript
// polly.ts
{
  mode: "replay",
  adapters: ["node-http", "fetch"],
  persister: "fs",
  persisterOptions: {
    recordingsDir: "tests/recordings",
    keepUnusedRequests: true,
  },
  recordIfMissing: !process.env.CI,
  matchRequestsBy: {
    method: true,
    headers: false,
    body: normalizePathsInBody(),
    order: false,
    url: true,
  },
}
```

**Key settings:**
- `keepUnusedRequests: true` — Preserves recordings from previous nodes in multi-node tests
- `headers: false` — Headers change between environments, so they're not matched
- `order: false` — Requests don't need to arrive in the same order

## Recording Structure

```
langgraph_app/tests/recordings/
├── ask-question_2673898045/
│   └── recording.har
├── plan-component_2598170600/
│   └── recording.har
├── website-builder_4064829088/
│   └── recording.har
└── [~70 other node-specific recordings]
```

Directory naming: `{kebab-case-node-name}_{hash}/recording.har`

## Path Normalization

The `normalizePathsInBody()` function ensures recordings work across machines:

```
Before:  /Users/brettshollenberger/.../langgraph_app/agents/
After:   /PROJECT_ROOT/langgraph_app/agents/
```

Without this, identical prompts would produce different request bodies on different machines, causing recording mismatches and expensive API calls.

## Poisoned Response Detection

Transient API errors are detected and excluded from recordings:

| Status | Condition | Reason |
|--------|-----------|--------|
| 400 | "credit balance is too low" | Transient billing error |
| 401 | Any | Authentication error |
| 404 | Contains `"model:` | Bad model name |
| 429 | Any | Rate limited |
| 503 | Any | Upstream error |

Poisoned responses get `recording.response = undefined` — Polly skips persisting them.

## Header Filtering

Sensitive headers are stripped before saving to HAR:
- `x-api-key`, `authorization`, `api-key`
- Anthropic rate limit headers (`anthropic-ratelimit-*`)
- Stainless headers (`x-stainless-*`)

## Passthrough Hosts

These hosts bypass recording/replay entirely:
- `api.smith.langchain.com` — LangSmith tracing (always real)
- `localhost:{RAILS_PORT}` — Rails API (always real)

## Integration with Tests

**Via GraphTestBuilder (automatic):**
```typescript
const result = await testGraph()
  .withGraph(websiteGraph)
  .withPrompt("Create a website")
  .stopAfter("nameProject")
  .execute();
// Polly managed automatically by withPolly middleware
```

**Via manual setup:**
```typescript
await startPolly("faqSearch", "replay");
// ... test code ...
await stopPolly();
```

## When Recordings Need Updating

| Change | Impact | Action |
|--------|--------|--------|
| Prompt text changes | Request body changes → no match | Re-record (costs API credits) |
| API schema changes | Response format changes | Delete recording, re-record |
| New test case | No existing recording | Auto-recorded locally |
| Model name changes | URL or body changes | Delete recording, re-record |

**To re-record:**
```bash
rm -rf langgraph_app/tests/recordings/{node-name}_{hash}/
pnpm test tests/path/to/test.ts  # Hits real API, saves new recording
```

## Key Files Index

| File | Purpose |
|------|---------|
| `langgraph_app/app/utils/polly.ts` | Core Polly configuration and helpers |
| `langgraph_app/app/core/node/middleware/withPolly.ts` | Node middleware for automatic recording |
| `langgraph_app/vitest.config.ts` | `fileParallelism: false` (critical for Polly) |
| `langgraph_app/tests/recordings/` | HAR recording files (~73 directories) |
| `langgraph_app/tests/support/setup.ts` | Global test setup |

## Gotchas

- **Never run tests in parallel**: Polly uses a global singleton for the recording name. Parallel execution causes cache misses → real API calls → $6+ per run.
- **`fileParallelism: false`**: Set in `vitest.config.ts` and enforced with `maxForks: 1`. This is not optional.
- **API credits required for re-recording**: Check balance before deleting recordings in bulk.
- **Prompt changes = new recording**: Any change to prompt text produces a different request body. The normalized body won't match the old HAR entry.
- **`keepUnusedRequests: true`**: Essential for multi-node graph tests where earlier nodes' recordings must survive later nodes' Polly sessions.
