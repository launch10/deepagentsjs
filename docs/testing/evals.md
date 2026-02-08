# Evaluations

The eval system measures AI agent output quality using LLM-as-judge scorers and programmatic checks. Three offline eval suites exist: website quality (8 cases), bug fix regression (5 cases), and ads instruction following (7 cases). Evals use the Evalite framework locally and are planned to run online in production via BullMQ workers pushing scores to LangSmith.

## Eval Suites

```
pnpm eval
  ├─ Website Eval (8 cases: 5 creates + 3 edits)
  │   └─ Scorers: DesignQuality + Persuasiveness + Completeness
  │   └─ Cost: ~$5-8 per run
  │
  ├─ Bug Fix Eval (5 injected bug cases)
  │   └─ Pre-fix validation → fix → post-fix validation
  │   └─ Cost: ~$0.60-1.80 per run
  │
  └─ Ads Eval (7 scenarios)
      └─ Scorers: FollowsUserInstructions + AnswersQuestion
```

## Scorers

### LLM-as-Judge (Claude Haiku)

| Scorer | Dimensions | Score Range |
|--------|-----------|-------------|
| **Design Quality** | Visual distinctiveness, hierarchy, typography, interactivity, memorability | 0.1–1.0 |
| **Persuasiveness** | Emotional triggers, value proposition, urgency, trust signals, CTA | 0.25–1.0 |
| **Follows Instructions** | Whether edits reflect user request vs original | 0.0–1.0 |
| **Answers Question** | Whether response addresses the question | 0.0–1.0 |

All LLM judges use structured output with chain-of-thought reasoning via `createScorer()` factory.

### Programmatic (No LLM, Instant)

| Scorer | Checks | Score |
|--------|--------|-------|
| **Landing Page Completeness** | Hero, 3+ components, CTA, footer, L10.createLead(), semantic colors, section rhythm, responsive, large headlines, padding, hover effects | passes / 12 |

## Running Evals

```bash
cd langgraph_app

pnpm eval                    # Run all via Evalite
pnpm eval:watch              # Watch mode
pnpm eval:debug              # Visual debug (interactive)
pnpm eval:debug [label]      # Debug specific case
pnpm eval:debug --list       # List all test cases

# Bug fix eval (via Vitest)
pnpm test tests/tests/graphs/website/bugFix.eval.test.ts
```

## Architecture

**Evalite pattern**: Heavy work in `data()` phase (sequential, no timeouts), instant lookup in `task()`:

```typescript
// website.eval.ts
evalite("Website Quality", {
  data: async () => {
    // Pre-compute ALL results sequentially
    // Restore snapshots, run graphs, capture output
    return testCases;
  },
  task: async (input) => {
    // Just lookup pre-computed result (instant)
    return results[input.label];
  },
  scorers: [designQuality, persuasiveness, completeness],
});
```

**Bug fix eval** uses Vitest directly with pre/post validation:

```typescript
test("missing-import", async () => {
  // 1. Inject bug (remove import statement)
  // 2. Validate bug exists (pre-fix check)
  // 3. Run coding agent to fix
  // 4. Validate fix applied (post-fix check)
  // 5. Check tracking code preserved (invariant)
});
```

## Online Evals (Planned)

Architecture designed but not yet implemented:

```
User requests create → WebsiteAPI.stream()
       │
       ▼
usageTrackingMiddleware.onComplete()
       │
       ▼
websiteScoringQueue.add({ websiteId, threadId, runId })
       │
       ▼
websiteScoringWorker:
  ├─ Fetch files from DB
  ├─ Run 3 scorers (~$0.02 per create)
  └─ langsmith.createFeedback(runId, score)
       │
       ▼
LangSmith Dashboard (continuous monitoring)
```

## Key Files Index

| File | Purpose |
|------|---------|
| `langgraph_app/tests/tests/graphs/website/website.eval.ts` | Website quality eval (8 cases) |
| `langgraph_app/tests/tests/graphs/website/bugFix.eval.test.ts` | Bug fix regression eval (5 cases) |
| `langgraph_app/tests/tests/graphs/ads/ads.eval.ts` | Ads instruction following eval |
| `langgraph_app/tests/support/evals/designQuality.ts` | Design quality LLM judge |
| `langgraph_app/tests/support/evals/persuasiveness.ts` | Copy persuasiveness LLM judge |
| `langgraph_app/tests/support/evals/landingPageCompleteness.ts` | Programmatic completeness check |
| `langgraph_app/tests/support/evals/createScorer.ts` | Generic scorer factory |
| `langgraph_app/tests/support/evals/eval-debug.ts` | Visual debugging tool |
| `langgraph_app/plans/evals.md` | Online eval implementation plan |

## Gotchas

- **Evals cost real money**: Website eval costs $5-8 per run (8 Claude API calls). Bug fix eval costs $0.60-1.80. Always check API credit balance before running.
- **Pre-computation pattern**: Evalite forces concurrent `task()` execution, but AI calls must be sequential. All heavy work happens in `data()` to avoid timeouts and race conditions.
- **Database snapshots required**: Evals restore `website_step` (creates) and `website_generated` (edits) snapshots. Rails test server must be running.
- **Debug output**: `pnpm eval:debug [label]` captures before/after screenshots and source code in `eval-debug-output/` for visual comparison.
