# Plan: Get Website Edits to <1 Cent

## First Principles: Where Every Cent Goes

Current edit cost (Sonnet 4.5, 3 LLM calls, after fixing double-count bug):

| Token Type | Tokens | Rate ($/M) | Cost | % of Total |
|-----------|--------|-----------|------|-----------|
| Cache Write | 18,203 | $6.00 | $0.109 | **74%** |
| Output | 1,879 | $15.00 | $0.028 | 19% |
| Cache Read | 31,584 | $0.30 | $0.009 | 6% |
| Input | 15 | $3.00 | $0.000 | 0% |
| **Total** | | | **$0.147** | |

**The killer: Call 3 is a subagent with a COLD CACHE MISS.**

- Call 1: 1,616 cache write (small delta after hit)
- Call 2: 1,590 cache write (small delta)
- Call 3: **14,997 cache write, 0 cache read** = $0.090 = **61% of total cost**

Call 3 is the subagent (coder). It has a different system prompt prefix, so it gets zero cache benefit from calls 1/2. We're paying $6/M to write 15K tokens to a cache that may never be read again.

**Sonnet 4.5's cache write rate ($6/M) is 2x the regular input rate ($3/M).** For sparse usage, caching a large prompt is a NET LOSS — you'd be cheaper sending it uncached.

## The Three Levers

| Lever | Current | Target | Savings |
|-------|---------|--------|---------|
| **1. Eliminate subagent** | 3 calls (main + coder + verify) | 1-2 calls | -61% (kills the cold miss) |
| **2. Use Haiku for edits** | Sonnet ($3/$15/$6/$0.30) | Haiku ($1/$5/$2/$0.10) | -67% on every token |
| **3. Minimize prompt** | ~15K tokens (system + 9 tools) | ~3-5K tokens | -60% on cache/input |

Combined: **$0.147 → $0.003-0.009**

## Target Cost Calculations

### Phase 1 alone: Remove subagent, keep Sonnet (easy win)

Single agent, 2 turns (read file → write file), warm cache:
- Cache read: 15,000 × $0.30/M = $0.0045
- Input (file + message): 1,500 × $3/M = $0.0045
- Output: 800 × $15/M = $0.012
- **Total: ~$0.021 (2.1 cents)** — 86% reduction

### Phase 1 + 2: Remove subagent + Haiku

Same flow but Haiku 4.5 rates:
- Cache read: 15,000 × $0.10/M = $0.0015
- Input: 1,500 × $1/M = $0.0015
- Output: 800 × $5/M = $0.004
- **Total: ~$0.007 (0.7 cents)** — under 1 cent!

### Phase 1 + 2 + 3: Remove subagent + Haiku + minimal prompt

Minimal prompt (~2K tokens), 2 turns:
- Cache read: 2,000 × $0.10/M = $0.0002
- Input: 1,500 × $1/M = $0.0015
- Output: 600 × $5/M = $0.003
- **Total: ~$0.005 (0.5 cents)** — 97% reduction

### Cold start (first edit, cache miss), Phase 1+2+3:
- Cache write: 2,000 × $2.00/M = $0.004
- Input: 1,500 × $1/M = $0.0015
- Output: 600 × $5/M = $0.003
- **Total: ~$0.009 (0.9 cents)** — still under 1 cent!

---

## The Key Insight

**For edits, the existing code IS the context.** The component already has the right patterns, theme colors, animations, tracking code. The agent reads the file, sees the patterns, and mimics them. It doesn't need a 15K token system prompt explaining design patterns that are visible in the code itself.

The 15K token system prompt is essential for CREATES (building from nothing). For EDITS, it's pure waste.

---

## Implementation Plan

### Phase 1: Create a Light Edit Agent (biggest impact)

**File: `langgraph_app/app/nodes/coding/lightEditAgent.ts`** (new)

Create a stripped-down agent using `createDeepAgent` with:
- **No subagents** (`subagents: []`)
- **Haiku model** (`getLLM({ skill: "coding", speed: "blazing", cost: "paid" })`)
- **Minimal system prompt** (~800-1200 tokens, see below)
- **No SearchIconsTool** (icons are already in the code)
- **Prompt caching middleware** (same as current, reuse cache across edits)

### Phase 2: Write the Light Edit Prompt

**File: `langgraph_app/app/prompts/coding/lightEdit.ts`** (new)

~800-1200 tokens. Focused on what's ESSENTIAL for editing.

### Phase 3: Route Edits to Light Agent

**File: `langgraph_app/app/nodes/website/websiteBuilder.ts`** (modify)

- **Creates** continue using the full Sonnet agent with rich system prompt and subagents.
- **Edits** use the light Haiku agent with minimal prompt and no subagents.

### Phase 4: Use Haiku via `speed: "blazing"`

`getLLM({ skill: "coding", speed: "blazing", cost: "paid" })` resolves to Haiku first.

### Phase 5: Update Exports

Add exports for new modules in index files.

---

## Files to Modify

| File | Change | New? |
|------|--------|------|
| `langgraph_app/app/nodes/coding/lightEditAgent.ts` | Light edit agent | New |
| `langgraph_app/app/prompts/coding/lightEdit.ts` | Minimal edit prompt | New |
| `langgraph_app/app/nodes/website/websiteBuilder.ts` | Route edits to light agent | Modify |
| `langgraph_app/app/nodes/coding/index.ts` | Export lightEditAgent | Modify |
| `langgraph_app/app/prompts/coding/index.ts` | Export lightEdit prompt | Modify |

---

## What We're NOT Changing

- **Create flow**: Still uses full Sonnet agent with rich prompt and subagents
- **deepagents library**: We use it as-is, just with different configuration
- **Filesystem backend**: Same WebsiteFilesBackend, same file sync
- **Cost tracking**: Same tracker (separate PR for double-counting fix)
- **Prompt caching middleware**: Same middleware, benefits both agents

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Haiku quality too low for complex edits | Medium | Monitor quality; can add Sonnet fallback for "complex" classification later |
| Missing design patterns without rich prompt | Low | The code already embodies the patterns; Haiku reads and mimics |
| Tracking code (L10.createLead) gets broken | Low | Explicit rule in light prompt to preserve tracking |
| Theme colors get wrong | Low | Colors are in the code via CSS variables; agent reads them |

## Verification

1. Run the website builder test: `pnpm test tests/tests/graphs/website/website.test.ts`
2. Verify the Hero Edit test still produces a valid component
3. Check cost summary — target: **<1 cent per edit** (vs current ~15 cents)
4. Verify cache behavior: second edit should show cache reads on system prompt
5. Manual test: run a few edits and verify quality (colors, layout, tracking intact)

## Expected Results

| Metric | Before | After | Improvement |
|--------|--------|-------|------------|
| Cost per edit | ~$0.147 | ~$0.005-0.009 | **95-97%** |
| LLM calls per edit | 3 | 1-2 | 50-67% fewer |
| System prompt tokens | ~15,000 | ~2,000-3,000 | 80% smaller |
| Cold start cost | $0.147 | ~$0.009 | 94% cheaper |
| Model | Sonnet ($3/$15) | Haiku ($1/$5) | 3x cheaper per token |

## Future Optimizations (not in this PR)

1. **Edit classification**: Route "complex" edits (redesign, new components) to Sonnet, simple edits to Haiku
2. **Diff-based output**: Instead of full file rewrites, output search/replace patches (~50% output token savings)
3. **Fix double-counting bug**: Read cache tokens from `response_metadata.usage` (separate PR)
4. **System prompt cache breakpoint**: Add `cache_control` to system prompt for cross-user sharing (benefits creates too)
