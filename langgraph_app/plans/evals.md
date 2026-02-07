# Eval Strategy

## Overview

Two eval systems serving different purposes:

1. **Online evals** — Score every production create flow in the background via BullMQ, push results to LangSmith for continuous quality monitoring
2. **Offline evals** — Periodic (weekly) comprehensive eval suites run via CI cron, results also pushed to LangSmith for historical tracking

Rails doesn't need to know about any of this. Scoring lives entirely in Langgraph.

## Current State

- `website.eval.ts` — Evalite-based, 5 creates + 3 edits, ~$5-8/run, 3 scorers (DesignQuality, Completeness, Persuasiveness). Run manually via `pnpm eval`.
- `bugFix.eval.test.ts` — Vitest-based, 5 injected bugs, ~$1-2/run. Run manually via `pnpm test`.
- Scorers live in `tests/support/evals/` — not importable from production code.
- No historical tracking, no production monitoring.

## Part 1: Online Evals (Background Scoring)

### Architecture

Follows the exact pattern of `documentExtractionWorker` — BullMQ queue + worker with retries.

```
User sends "Create a landing page"
    │
    ▼
WebsiteAPI.stream() → page generated, shown to user
    │
    ▼
usageTrackingMiddleware.onComplete() fires
    ├── notifyRails(runId)                          ← existing, charges credits
    └── websiteScoringQueue.add({                   ← NEW
          websiteId, threadId, runId, userMessage
        })
            │
            ▼
websiteScoringWorker (BullMQ, retries: 3, exponential backoff)
    ├── collectFiles(websiteId) from DB
    ├── LandingPageCompletenessScorer(files)         ← programmatic, instant, free
    ├── Promise.all([                                ← parallel LLM-as-judge
    │     DesignQualityScorer({ input, output }),
    │     PersuasivenessScorer({ input, output }),
    │   ])
    └── langsmithClient.createFeedback(runId, ...)   ← push 3 scores
```

### Cost

~$0.02 per create (two Haiku LLM-as-judge calls). At 100 creates/week = ~$2/week.

Completeness scorer is free (programmatic checks, no LLM call).

### Implementation Steps

#### Step 1: Move scorers to production code

Move from `tests/support/evals/` to `app/core/evals/`:

```
app/core/evals/
  index.ts
  createScorer.ts              ← from tests/support/evals/createScorer.ts
  designQuality.ts             ← from tests/support/evals/designQuality.ts
  persuasiveness.ts            ← from tests/support/evals/persuasiveness.ts
  landingPageCompleteness.ts   ← from tests/support/evals/landingPageCompleteness.ts
```

Test code re-exports from `app/core/evals/` so existing eval tests don't break:

```typescript
// tests/support/evals/index.ts
export * from "@core/evals";
```

#### Step 2: Create the queue

`app/queues/websiteScoring.ts` — follows `documentExtraction.ts` pattern:

```typescript
import { Queue } from "bullmq";
import { queueConnection } from "./connection";

export interface WebsiteScoringJobData {
  websiteId: number;
  threadId: string;
  runId: string;
  userMessage: string;
  graphName: string; // "website" — for filtering in LangSmith
}

export const websiteScoringQueue = new Queue<WebsiteScoringJobData>("website-scoring", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 7 * 24 * 3600, count: 500 },
    removeOnFail: { age: 14 * 24 * 3600 },
  },
});
```

#### Step 3: Create the worker

`app/workers/websiteScoringWorker.ts` — follows `documentExtractionWorker.ts` pattern:

```typescript
import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../queues/connection";
import type { WebsiteScoringJobData } from "../queues/websiteScoring";
import {
  DesignQualityScorer,
  PersuasivenessScorer,
  LandingPageCompletenessScorer,
} from "@core/evals";
import { db, websiteFiles, eq } from "@db";
import { getLogger } from "@core";
import { Client as LangSmithClient } from "langsmith";

const log = getLogger({ component: "WebsiteScoringWorker" });
const langsmith = new LangSmithClient();

async function collectFiles(websiteId: number) {
  const files = await db.select().from(websiteFiles).where(eq(websiteFiles.websiteId, websiteId));
  const fileMap: Record<string, { content: string }> = {};
  for (const f of files) {
    if (f.path) fileMap[f.path] = { content: f.content };
  }
  return fileMap;
}

function extractSourceCode(files: Record<string, any>): string {
  return Object.entries(files)
    .filter(([path]) => /\.(tsx?|css)$/.test(path) && path.includes("src/"))
    .map(([path, f]) => `### ${path}\n\`\`\`tsx\n${f.content}\n\`\`\``)
    .join("\n\n");
}

async function scoreWebsite(job: Job<WebsiteScoringJobData>) {
  const { websiteId, runId, userMessage } = job.data;

  const files = await collectFiles(websiteId);
  const sourceCode = extractSourceCode(files);

  if (!sourceCode) {
    log.warn({ websiteId, runId }, "No source files found, skipping scoring");
    return;
  }

  // Run all three scorers (LLM judges in parallel, completeness is instant)
  const [designScore, persuasivenessScore, completenessScore] = await Promise.all([
    DesignQualityScorer({ input: userMessage, output: sourceCode, useCoT: true }),
    PersuasivenessScorer({ input: userMessage, output: sourceCode, useCoT: true }),
    Promise.resolve(LandingPageCompletenessScorer(files)),
  ]);

  log.info({ runId, designScore, persuasivenessScore, completenessScore }, "Scores computed");

  // Push to LangSmith
  await Promise.all([
    langsmith.createFeedback(runId, "design_quality", { score: designScore }),
    langsmith.createFeedback(runId, "completeness", { score: completenessScore }),
    langsmith.createFeedback(runId, "persuasiveness", { score: persuasivenessScore }),
  ]);

  log.info({ runId }, "Scores pushed to LangSmith");
}

// Worker setup (same pattern as documentExtractionWorker)
const connection = createRedisConnection();

export const websiteScoringWorker = new Worker<WebsiteScoringJobData>(
  "website-scoring",
  scoreWebsite,
  { connection, concurrency: 2, autorun: true }
);

// ... standard event handlers, shutdown hooks (same as documentExtractionWorker)
```

#### Step 4: Enqueue from onComplete

In `usageTrackingMiddleware.onComplete()`, after `notifyRails(runId)`:

```typescript
// Only score website create flows
if (ctx.graphName === "website") {
  const { websiteScoringQueue } = await import("../queues/websiteScoring");
  websiteScoringQueue
    .add("score", {
      websiteId: /* from state or DB lookup */,
      threadId: ctx.threadId,
      runId,
      userMessage: /* first human message from messages array */,
      graphName: ctx.graphName,
    })
    .catch((err) => log.warn({ err, runId }, "Failed to enqueue scoring"));
}
```

#### Step 5: LangSmith setup

Environment variables (add to `.env`):

```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls_xxx
LANGCHAIN_PROJECT=launch10-production
```

LangGraph with LangChain already supports tracing natively — setting these env vars is all that's needed for traces to flow. The `createFeedback` calls attach scores to those traces.

### What This Gets Us

- **Dashboard**: LangSmith shows design quality / completeness / persuasiveness over time
- **Alerts**: Set threshold alerts (e.g. "notify Slack if avg design_quality drops below 0.6 over 15 min")
- **Drill-down**: Click any low-scoring trace to see the full agent execution, files generated, and scorer reasoning (CoT)
- **Dataset building**: One-click add low-scoring traces to a regression dataset for offline evals

### Open Questions

- **Score edits too?** Edits are cheap (~$0.005) but the scorers add ~$0.02. Could score a sample (e.g. 1 in 5 edits). Start with creates only.
- **LangSmith run ID mapping**: `runId` in `usageContext` is our internal ID. Need to verify this maps to (or can be correlated with) the LangSmith trace ID. May need to pass the LangSmith run ID from the trace callback instead.
- **Worker startup**: The worker needs to be started alongside the existing `documentExtractionWorker`. Check if there's a unified worker entrypoint or if each worker is started separately.

---

## Part 2: Offline Evals (CI Scheduled)

### Architecture

Existing evalite/vitest evals, triggered by GitHub Actions cron, results pushed to LangSmith.

### Implementation

#### GitHub Actions workflow

```yaml
# .github/workflows/eval-weekly.yml
name: Weekly Website Eval
on:
  schedule:
    - cron: "0 2 * * 0" # Sundays 2 AM UTC
  workflow_dispatch: {} # Manual trigger button

jobs:
  website-eval:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: launch10_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports: ["5432:5432"]
      redis:
        image: redis:7
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install
        working-directory: langgraph_app
      - run: pnpm run db:migrate
        working-directory: langgraph_app
        env:
          POSTGRES_URI: postgres://postgres:postgres@localhost:5432/launch10_test
      - run: pnpm eval
        working-directory: langgraph_app
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          POSTGRES_URI: postgres://postgres:postgres@localhost:5432/launch10_test
          REDIS_URI: redis://localhost:6379
          LANGCHAIN_TRACING_V2: true
          LANGCHAIN_API_KEY: ${{ secrets.LANGCHAIN_API_KEY }}
          LANGCHAIN_PROJECT: launch10-evals
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: eval-results-${{ github.run_id }}
          path: langgraph_app/evalite-report/
          retention-days: 90

  bugfix-eval:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: launch10_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports: ["5432:5432"]
      redis:
        image: redis:7
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install
        working-directory: langgraph_app
      - run: pnpm run db:migrate
        working-directory: langgraph_app
        env:
          POSTGRES_URI: postgres://postgres:postgres@localhost:5432/launch10_test
      - run: pnpm test tests/tests/graphs/website/bugFix.eval.test.ts
        working-directory: langgraph_app
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          POSTGRES_URI: postgres://postgres:postgres@localhost:5432/launch10_test
          REDIS_URI: redis://localhost:6379
```

#### Bug fix eval on merge to main (optional, ~$2/run)

```yaml
# .github/workflows/eval-on-merge.yml
name: Bug Fix Eval (post-merge)
on:
  push:
    branches: [main]
    paths:
      - "langgraph_app/app/nodes/coding/**"
      - "langgraph_app/app/prompts/coding/**"
      - "langgraph_app/app/graphs/website*.ts"
```

Only triggers when coding agent code changes. Catches regressions from prompt or tool changes.

### Open Questions

- **Database snapshots in CI**: The evals rely on `DatabaseSnapshotter.restoreSnapshot()`. Need to either seed the CI database with the snapshots, or include snapshot SQL dumps in the repo / as CI artifacts.
- **Polly recordings**: Bug fix eval may need recordings or real API access. If real API, cost is ~$2/run. If recordings, they need to be committed or fetched.

---

## Part 3: LangSmith Dashboard Setup

After Parts 1 & 2 are wired up, configure in LangSmith UI:

### Projects

- `launch10-production` — receives traces from production, online eval scores attach here
- `launch10-evals` — receives traces from CI eval runs

### Alerts (production project)

| Metric             | Threshold | Window | Action        |
| ------------------ | --------- | ------ | ------------- |
| design_quality avg | < 0.6     | 15 min | Slack webhook |
| completeness avg   | < 0.8     | 15 min | Slack webhook |
| persuasiveness avg | < 0.5     | 15 min | Slack webhook |
| error rate         | > 10%     | 5 min  | Slack webhook |

### Datasets (built over time)

- **low-design-quality** — traces scoring < 0.5 on design, manually curated for regression testing
- **low-completeness** — traces missing structural requirements
- **production-creates** — random sample of production creates for periodic offline re-evaluation

---

## Implementation Priority

| Phase  | What                                            | Effort             | Value                        |
| ------ | ----------------------------------------------- | ------------------ | ---------------------------- |
| **1a** | Move scorers to `app/core/evals/`               | 30 min             | Unblocks everything          |
| **1b** | BullMQ queue + worker + enqueue from onComplete | 2-3 hrs            | Online scoring running       |
| **1c** | LangSmith env vars + `createFeedback` calls     | 30 min             | Scores visible in dashboard  |
| **2**  | GitHub Actions cron for weekly evals            | 1-2 hrs            | Automated offline evals      |
| **3**  | LangSmith alerts + Slack notifications          | 30 min (UI config) | Proactive quality monitoring |

Phase 1 (a+b+c) is the highest leverage — gives continuous production quality monitoring for ~$2/week.
