# Plan: Smart Cost Cutting — 10-100x Cheaper Edits

## Status

Draft

## Problem

Our website edit flow costs ~$0.15 per edit (full agent) or ~$0.005-0.009 (light agent), but suffers from two structural problems:

1. **edit_file fails 30-50% of the time** because it uses exact string matching. The LLM guesses wrong on whitespace/formatting, retries 3x identically (wasting ~5s and tokens), then falls back to write_file (rewriting the entire file as expensive output tokens). This turns a $0.005 edit into a $0.02+ edit with 25s of wasted time.

2. **We're optimizing the wrong token type.** Output tokens cost 5x input tokens ($15/M vs $3/M for Sonnet, $5/M vs $1/M for Haiku). Our agent's biggest cost is *generating* failed edit attempts and full file rewrites (output), not reading files (input).

3. **We lack a reliable way to route** between agent tiers (full/light/superlight) — the regex classifier works but we have no feedback loop to know if it's routing correctly.

## Two Breakthrough Ideas

### Idea 1: Increase Input to Decrease Output

**The counterintuitive move.** Pre-load all target file contents into the system prompt (input tokens — cheap, especially with caching at $0.30/M for Sonnet, $0.10/M for Haiku). Then have the LLM output ONLY the minimal change.

| Approach | Output tokens | Output cost (Haiku) | Notes |
|----------|--------------|---------------------|-------|
| write_file (full rewrite) | ~2,000-4,000 | $0.010-0.020 | Current fallback |
| edit_file old_string/new_string | ~500-2,000 | $0.003-0.010 | Current primary (when it works) |
| Line-range edit "replace lines 45-52" | ~200-600 | $0.001-0.003 | Minimal output |
| Model-native str_replace (small anchor) | ~100-400 | $0.001-0.002 | Best case |

**The superlight agent already does this!** `superlightEditAgent.ts` pre-reads target files via `detectTargetFiles()` and injects them into the system prompt. This is the right idea — we just need to combine it with a more reliable edit mechanism.

The math:
- Pre-loading a 200-line component: ~3K input tokens × $0.10/M (Haiku cached) = **$0.0003**
- Saving one write_file fallback: ~3K output tokens × $5/M (Haiku) = **$0.015**
- **ROI: spend $0.0003 to save $0.015 = 50x return**

### Idea 2: Model-Native Tools vs. Generic Tool Descriptions

This is the biggest single lever nobody in the ecosystem is talking about yet.

Our `edit_file` tool is a generic JSON-schema tool that any LLM has to figure out from the description. The LLM hasn't been specifically trained on it, so it does dumb things like trying to replace a 4,063-character block.

**Anthropic's `str_replace_editor` is trained INTO Claude's model weights.** When Claude sees that tool, it:
- Picks small, unique anchor strings (not 4K-char blocks)
- Gets whitespace exactly right
- Succeeds on first try ~90%+ of the time
- Knows to use `view` before `str_replace`

Available via the Anthropic API as a built-in tool type:

```typescript
// Instead of a generic tool definition:
{
  type: "function",
  function: {
    name: "edit_file",
    description: "Replace old_string with new_string in a file",
    parameters: { ... }
  }
}

// Use the model-native tool:
{
  type: "text_editor_20250429",
  name: "str_replace_editor"
}
```

**This is like asking someone to use a screwdriver they've used 10 million times vs. one they've never seen before.**

The impact:
- ~90%+ first-try success rate (vs. ~50-70% with generic edit_file)
- No retry waste (saves ~5s and tokens per failed attempt)
- Smaller old_string selections = fewer output tokens
- No fallback to write_file = no full-file rewrite output cost

## The Agent Loop Tax: Why Fewer Iterations Matters More Than Cheaper Iterations

Most people think "5 iterations = 5x the cost." **Wrong.** It's O(n²) because each iteration re-sends ALL previous context:

```
Iter 1: system + user message                     =  5K tokens
Iter 2: system + user + iter1 output + tool result = 15K tokens
Iter 3: system + everything from 1-2              = 25K tokens
Iter 4: system + everything from 1-3              = 35K tokens
Iter 5: system + everything from 1-4              = 45K tokens
                                          TOTAL  = 125K tokens
```

**You're paying for 125K cumulative input tokens when the actual NEW information is only ~25K. That's 5x overhead from context re-sending alone.**

With prompt caching, the repeated prefix is cheaper ($0.30/M vs $3/M) — but the optimal solution is still to eliminate iterations:

| Iterations | Cumulative input tokens | With caching | Without |
|-----------|------------------------|-------------|---------|
| 1 | 5K | $0.005 | $0.015 |
| 2 | 20K | $0.008 | $0.060 |
| 3 | 45K | $0.016 | $0.135 |
| 5 | 125K | $0.042 | $0.375 |

**Going from 5 iterations to 1 is ~8x cheaper even WITH caching, and 25x cheaper without.**

---

## Routing: How to Pick the Right Agent Level

### Current State

We have three tiers:

| Tier | Agent | Model | Cost/edit | When |
|------|-------|-------|-----------|------|
| Full | `createCodingAgent` | Sonnet | ~$0.15 | Creates, bugs, complex restructuring |
| Light | `createLightEditAgent` | Haiku | ~$0.01-0.02 | (currently unused in websiteBuilder) |
| Superlight | `createSuperlightEditAgent` | Haiku | ~$0.005-0.009 | Simple edits (color, text, spacing) |

Routing is via `classifyEdit()` — a regex-based classifier that checks for COMPLEX_PATTERNS (structural keywords) and SIMPLE_PATTERNS (cosmetic keywords). Complex → full agent, simple → superlight.

### The Routing Question: Do We Need LLM Decision-Making?

**No. Here's why:**

1. **The regex classifier is already good.** It catches the obvious cases (create vs edit, bug vs tweak) with zero cost and zero latency. Using an LLM to classify would add ~$0.001 and ~1-2s — small but pointless for clear-cut cases.

2. **The real problem isn't routing — it's that the cheap path is too unreliable.** When the superlight agent's edit_file fails, it wastes time and tokens before falling back to write_file. If we make the cheap path reliable (model-native tools + pre-loaded context), 80%+ of edits succeed in 1-2 calls regardless of "complexity."

3. **Most "complex" edits are actually just large simple edits.** "Make the hero look like the features section" sounds complex but it's really: read both files, generate new Hero.tsx. One call with pre-loaded context.

### The Right Architecture: Reliable Cheap Path + Escalation

```
User message
     │
     ▼
┌─────────────────────────────┐
│  classifyEdit() (regex, 0ms) │
│  Is this a create, bug, or  │
│  structural change?          │
└──────────┬──────────────────┘
           │
     ┌─────┴─────┐
     │           │
  "simple"    "complex"
     │           │
     ▼           ▼
┌──────────┐  ┌──────────────┐
│ Smart    │  │ Full Agent   │
│ Single-  │  │ (Sonnet,     │
│ Shot     │  │  subagents,  │
│ (Haiku,  │  │  full prompt)│
│ pre-load,│  │              │
│ native   │  │              │
│ tools)   │  │              │
└──────────┘  └──────────────┘
   $0.002        $0.15
```

The "smart single-shot" path is the key innovation. It combines:
- Pre-loaded file contents (from superlight agent's approach)
- Model-native `str_replace_editor` tool (from Anthropic API)
- 1-2 LLM calls max (no agent loop for simple edits)

### How to "Fine-Tune" Routing Without Fine-Tuning

You don't need ML. You need a feedback loop:

#### Step 1: Instrument (Week 1)

Log every edit request with:
```typescript
{
  userMessage: string,
  classifiedAs: "simple" | "complex",
  agentUsed: "superlight" | "light" | "full",
  llmIterations: number,
  toolCalls: { name: string, success: boolean }[],
  totalCost: number,
  totalDuration: number,
  // Did the cheap path escalate (e.g. fell back to write_file)?
  escalated: boolean,
}
```

#### Step 2: Review Weekly (Ongoing)

Look for two failure modes:

**Under-routing (classified simple, should have been complex):**
- Signs: superlight agent used 4+ iterations, or escalated to write_file, or user complained
- Fix: add the pattern to COMPLEX_PATTERNS

**Over-routing (classified complex, could have been simple):**
- Signs: full agent used only 1-2 iterations, made a small edit
- Fix: add an exception to COMPLEX_PATTERNS or add to SIMPLE_PATTERNS

#### Step 3: Tighten the Regex (Monthly)

After collecting 100+ labeled examples:
- Which COMPLEX_PATTERNS fire but shouldn't? (false positives)
- Which requests are missing from SIMPLE_PATTERNS? (false negatives)
- What's the actual simple/complex ratio? (expect 70-80% simple)

#### Step 4: Graduate to a Classifier (Only if needed)

Once you have 500+ labeled examples, you *could* train a tiny classifier (logistic regression on TF-IDF features, or a fine-tuned embedding + linear layer). But honestly? A well-tuned regex handles 95% of cases. The remaining 5% isn't worth the engineering complexity for a startup.

**The real "fine-tuning" is tuning the cheap path to handle more cases reliably, not tuning the router to route more precisely.**

---

## Implementation Plan

### Phase 1: Model-Native Edit Tool (Biggest impact, most novel)

**Goal:** Replace generic `edit_file` with Anthropic's `str_replace_editor`.

**Challenge:** Our agents use langchain's `createAgent` / `createDeepAgent`, which sends tools as generic function schemas. The Anthropic native `text_editor` tool uses a different format (`type: "text_editor_20250429"`).

**Options:**
1. **Use Anthropic SDK directly** (bypass langchain for the edit call) — scrappy, works now
2. **Check if langchain supports native tool types** — may be supported via `tool_choice` or custom tool binding
3. **Wrap str_replace_editor as a langchain tool** — gives us the schema but not the model-native behavior (doesn't help)

**Research needed:** Does passing `type: "text_editor_20250429"` through langchain's Anthropic provider work? If yes, we just need to configure it. If no, we may need to call the Anthropic API directly for the edit step.

**Fallback approach:** If model-native tool integration is hard, we can still dramatically improve the generic `edit_file` by:
- Adding fuzzy matching (Levenshtein distance to find closest match)
- Adding line-number support ("replace lines 45-52")
- Returning the actual error message to the LLM (not MiddlewareError)

### Phase 2: Pre-load + Single-Shot Path

**Goal:** For simple edits, eliminate the agent loop entirely.

**Approach:** Build on the superlight agent's pre-loading logic, but instead of running an agent loop, make a single API call:

```typescript
// Pseudocode for the "smart single-shot" path
async function smartSingleShot(state, userMessage) {
  const backend = await getCodingAgentBackend(state);
  const { tree, allPaths } = await buildFileTree(backend);
  const targetPaths = detectTargetFiles(userMessage, allPaths);
  const preReadContent = await preReadFiles(backend, targetPaths);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    system: buildSmartEditPrompt(tree, preReadContent),
    messages: [{ role: "user", content: userMessage }],
    tools: [{
      type: "text_editor_20250429",
      name: "str_replace_editor"
    }],
  });

  // Apply the edits from tool_use blocks
  for (const block of response.content) {
    if (block.type === "tool_use") {
      await applyEdit(backend, block.input);
    }
  }
}
```

This is 1 LLM call. No agent loop. Pre-loaded context. Model-native tool. ~$0.002 per edit.

### Phase 3: Instrument the Feedback Loop

**Goal:** Know if routing is working.

Add structured logging to `websiteBuilder.ts`:
- Classification result
- Agent used
- Iteration count
- Tool success/failure
- Total cost
- Whether it escalated

### Phase 4: Tighten Routing Based on Data

**Goal:** Route more requests to the cheap path.

Review logs weekly. Expand SIMPLE_PATTERNS. Shrink the "default to complex" fallback as confidence grows.

---

## Cost Projections

| Approach | Cost/edit | vs. Current | Notes |
|----------|-----------|-------------|-------|
| Current full agent | $0.150 | baseline | 5 iterations, Sonnet |
| Current superlight | $0.005-0.009 | 95% cheaper | But edit_file fails often |
| Smart single-shot (Haiku + native tools) | ~$0.002 | **98.7% cheaper** | 1 call, pre-loaded, native edit |
| Smart single-shot (Haiku, cache warm) | ~$0.001 | **99.3% cheaper** | Cached system prompt |

At $0.002/edit, a user doing 50 edits/day costs us $0.10/day = **$3/month in LLM costs.**

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Anthropic native tool doesn't work through langchain | Medium | Direct API call as fallback; or improve generic edit_file with fuzzy matching |
| Single-shot can't handle multi-file edits | Medium | Detect multi-file requests and route to agent loop |
| Haiku quality drops on complex style changes | Low | The pre-loaded file gives Haiku all the context it needs to mimic patterns |
| Regex over-routes to expensive path | Low | Instrument and review; default-complex is safe |

## Files to Modify

| File | Change |
|------|--------|
| `langgraph_app/app/nodes/coding/smartEditAgent.ts` | New: single-shot edit with native tools |
| `langgraph_app/app/nodes/website/websiteBuilder.ts` | Route simple edits to smart single-shot |
| `langgraph_app/app/nodes/website/classifyEdit.ts` | Add logging; potentially expand patterns |

## Verification

1. Run on the same trace input: "Let's make the hero visually more like the features section, please"
2. Compare: iterations (target: 1), cost (target: <$0.005), duration (target: <5s)
3. Check edit quality: same or better output as current approach
4. Verify no tracking code (L10.createLead) gets removed

## Related Plans

- [Aggressive Cost Cutting](./aggressive-cost-cutting.md) — The predecessor plan that got us to the light/superlight agents
- [Coding Agent Plans](./coding-agent/) — Full agent architecture documentation
