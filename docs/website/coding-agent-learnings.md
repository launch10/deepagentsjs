# Coding Agent System: Architecture & Production Learnings

## 1. Introduction

This document captures institutional knowledge about the coding agent system — the AI-powered engine that builds and edits landing pages in Launch10. It's not an API reference (see `docs/website/coding-agent.md` for that). Instead, it records *why* each piece exists, what problems motivated it, and what we learned from running it in production.

**Audience**: Future engineers, and ourselves in six months when the context has faded.

**Reading order**: Sections 2-5 cover the core dispatch architecture (how requests flow). Sections 6-8 cover cost and context optimization. Sections 9-12 cover error handling and streaming. Sections 13-15 cover design constraints, gap analysis, and meta-lessons.

---

## 2. Architecture Overview

The website graph is an intent-routed graph built with `createIntentGraph` (`langgraph_app/app/graphs/shared/createIntentGraph.ts`). Each user message flows through intent classification, then dispatches to the appropriate subgraph:

```
Intent Router (createIntentGraph)
├── change_theme → updateWebsite → themeHandler → END         (silent, no AI)
├── improve_copy → updateWebsite → improveCopy → cleanup → sync → END
└── default      → updateWebsite → buildContext
                                   ├── websiteBuilder → compactConversation → cleanup → sync → END
                                   └── recommendDomains → cleanup → sync → END (or skipToEnd in cache mode)
```

The intent router always clears the intent after any subgraph completes (`clearIntent` node), and the entire graph is wrapped with `withCreditExhaustion` for billing.

**Source**: `langgraph_app/app/graphs/website.ts`

---

## 3. The Dispatch System: Three-Tier Routing

The most important architectural decision. Every user message passes through up to three routing layers before any code is generated.

### Tier 1: Intent Routing (graph level)

`createIntentGraph` dispatches to `change_theme`, `improve_copy`, or `default` based on `state.intent?.type`. Why separate graphs: themes are a silent DB operation (no AI messages), copy improvement is a specialized single-node flow, and the default path needs the full agent with parallel domain recommendations.

### Tier 2: Complexity Routing (agent level)

Within the default subgraph, `resolveRoute()` in `langgraph_app/app/nodes/coding/agent.ts:226` decides between single-shot and the full agent:

| Condition | Route | Rationale |
|-----------|-------|-----------|
| `state.isCreateFlow === true` | full | Create needs parallel subagents |
| `state.errors` present | full | Debugging needs tool loops |
| Console errors with `type === "error"` | full | Build errors need investigation |
| Custom `systemPrompt` provided | full | Specialized behavior doesn't fit single-shot's prompt |
| Image context in messages | full | Image swaps touch multiple files |
| Otherwise | LLM classifier decides | Haiku-class model, ~$0.001 per classification |

The classifier (`classifyEditWithLLM` in `singleShotEdit.ts:33`) receives the user message and the **file tree** (not file contents) — cheap and fast. It returns `"simple"` or `"complex"`.

On classifier failure, it defaults to `"complex"` (safer to overshoot cost than underdeliver quality):

```typescript
// singleShotEdit.ts:70-73
} catch (e) {
  getLogger().warn({ err: e }, "Edit classifier failed, defaulting to complex");
  return "complex";
}
```

### Tier 3: Escalation

If single-shot fails after retry, it auto-escalates to the full agent. The user sees `"This change needs a bit more work — taking a closer look..."` (`agent.ts:390-393`). This message matters for UX — the user understands why the response takes longer.

### Key Learnings

- **File tree (not file contents) is enough for classification** — the classifier just needs to know what files exist and what the user is asking. This keeps classification at ~$0.001.
- **The cost difference is 100x** ($0.005 single-shot vs $0.50 full agent), making routing the highest-leverage optimization in the system.
- **Conservative defaults win**: defaulting to the expensive path on uncertainty is better than returning a broken edit to the user.

---

## 4. Single-Shot Edit Path

The fast path for simple edits. Source: `langgraph_app/app/nodes/coding/singleShotEdit.ts`

### Pre-loading Strategy

All source files are loaded into the system prompt before the LLM call. The filter excludes `components/ui/` (shadcn library — rarely edited, saves ~15K tokens of noise):

```typescript
// singleShotEdit.ts:204-206
const sourcePaths = allPaths.filter(
  (p) => p.includes("src/") && !p.includes("/components/ui/") && /\.(tsx?|css)$/.test(p)
);
```

This was learned through experience: including shadcn components was pure noise that never improved edit quality.

### Native Text Editor Tool

Uses Anthropic's `text_editor_20250728` (native `str_replace_based_edit_tool`) instead of custom tool calls:

```typescript
const NATIVE_TEXT_EDITOR_TOOL = {
  type: "text_editor_20250728" as const,
  name: "str_replace_based_edit_tool" as const,
  cache_control: { type: "ephemeral" as const },
};
```

The model was trained on this tool, so it's more reliable than custom alternatives. The `cache_control` breakpoint on the tool definition caches it alongside the system prompt.

### Tell-Then-Do Pattern

The prompt says: *"Start with a brief message describing what you'll change, THEN make edits."* This means the user sees streaming text immediately while edits are being processed. Combined with the `"notify"` tag on the model config, tokens stream to the frontend in real-time.

### Two-Pass Retry

1. Apply edits. If ALL fail, collect error messages + re-read current file contents as "anchors"
2. Retry with error context + the instruction `"Use str_replace to make your edits. Do NOT call view."`
3. If retry also fails completely → escalate to full agent (set `allFailed: true`)
4. Partial success = done (don't retry what already worked)

### View Command Wastage

Models sometimes call `view` even though files are pre-loaded. We detect and filter these:

```typescript
// singleShotEdit.ts:263-264
const editCalls = toolCalls.filter((tc: any) => (tc.args as any)?.command !== "view");
const viewCalls = toolCalls.filter((tc: any) => (tc.args as any)?.command === "view");
```

On retry, the prompt explicitly says: *"All files are already pre-loaded in the system prompt above — NEVER use the 'view' command."*

### Tool Evidence in History

Return messages include the full tool evidence chain: `AIMessage(tool_use) → ToolMessages → AIMessage(summary)`. This prevents the model from hallucinating in future turns — it sees that tools were used for changes, not just text descriptions.

---

## 5. Full Agent Path (Deep Agents + Subagents)

The heavyweight path for complex edits and create flows. Source: `langgraph_app/app/nodes/coding/agent.ts`

### Architecture

`createDeepAgent()` from the deepagents library with:
- Parent Sonnet agent plans work and delegates
- Parallel coder subagents implement sections simultaneously
- `SearchIconsTool` for semantic Lucide React icon search
- `ChangeColorSchemeTool` for theme-wide color changes
- Middleware stack: `toolErrorSurfacing → promptCaching → todoOverride`

```typescript
// agent.ts:97-101
return [
  createToolErrorSurfacingMiddleware(),
  createPromptCachingMiddleware(),
  todoOverrideMiddleware,
];
```

### Subagent Design

Subagents (`langgraph_app/app/nodes/coding/subagents/coder.ts`) get static context only (system prompt, theme, file tree via `buildStaticContextPrompt()`). Task-specific instructions come via the `task()` tool call at runtime, not baked into prompts. This keeps subagent prompts **cacheable** across different tasks — the expensive ~11K system prompt is processed once and reused.

### Todo Override Middleware

deepagents' built-in `todoListMiddleware()` is hardcoded to skip todos for "simple" tasks (<3 steps). But our agent dispatches 4-6 subagents — users need visibility into progress. The custom `todoOverrideMiddleware` (`agent.ts:60-88`) appends AFTER the built-in middleware (getting "last word" advantage):

Key instructions it reinforces:
- Always begin with a friendly 1-2 sentence message BEFORE any tool calls
- Always `write_todos` when delegating to subagents
- Mark ALL parallel subagents as `in_progress` when dispatching
- Always pass `todo_id` to `task()` for real-time auto-completion
- Keep todos non-technical: *"Build the hero section"* not *"Edit Hero.tsx"*

---

## 6. Prompt Caching: The 90% Cost Reduction

Source: `langgraph_app/app/core/llm/promptCachingMiddleware.ts`

Three-tier Anthropic prompt caching using `cache_control` breakpoints:

### Tier 1: System Prompt (~11K tokens)

Cached independently across conversations, users, and subagent invocations. Cache reads cost 10% of the base input token price.

```typescript
// promptCachingMiddleware.ts:130-133
const cachedSystemMessage = cacheSystemMessage(request.systemMessage, ttl);
```

### Tier 2: Tool Definitions

Tool schemas are static across turns. Marking the last tool definition with a breakpoint caches the entire tools array alongside the system prompt:

```typescript
// promptCachingMiddleware.ts:138
const cachedTools = cacheTools(request.tools, ttl);
```

### Tier 3: Last Message (Conversation Prefix)

Within a single conversation, each new turn only processes the delta. The growing prefix is cached automatically.

### Ordering Matters

Static sections (role, tools, design philosophy) come FIRST in the prompt. Dynamic sections (workflow mode, theme typography) come LAST. This maximizes cache hit ratio because the stable prefix is longer.

### Single-Shot Special Case

`promptCachingMiddleware` only applies to agent loops (via `wrapModelCall`), not to direct `.invoke()` calls. Single-shot adds `cache_control` manually on the system message's last content block:

```typescript
// singleShotEdit.ts:173-181
return new SystemMessage({
  content: [{
    type: "text",
    text,
    cache_control: { type: "ephemeral" as const },
  }],
});
```

### Key Insight

Without prompt caching, every subagent invocation re-processes the full ~11K system prompt. With it, the 2nd-6th subagents are ~90% cheaper. For a create flow with 6 subagents, this saves ~$0.30 per request.

---

## 7. Context Management: The Hardest Problem

Four layers of context management, each solving a different problem.

### Layer 1: Message Sanitization

Source: `langgraph_app/app/nodes/coding/messageUtils.ts`

Strips orphaned tool artifacts that cause Claude API errors:

**Orphaned `tool_use`**: AIMessages with `tool_calls` not followed by ToolMessages → stripped to text-only.

**Orphaned `tool_result`**: ToolMessages whose preceding AIMessage was removed (e.g., by compaction) → dropped.

Two-pass algorithm: first identify preserved tool_call IDs (those with paired ToolMessages), then filter everything else. Without this, the Claude API throws `"tool_use without tool_result"` errors.

### Layer 2: Context Window Safety Net

Source: `langgraph_app/app/nodes/website/contextWindow.ts`

Pure function, no LLM calls — just windowing. This is the "safety ceiling" for when compaction hasn't run yet.

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `maxTurnPairs` | 10 | Human+AI turn pairs to keep |
| `maxChars` | 40,000 | Total character ceiling |

Key behaviors:
- Context messages (`name="context"`) always kept, placed FIRST for caching
- AI+ToolMessage groups treated as atomic — never split
- If a group exceeds limits, strip tool blocks instead of orphaning them

### Layer 3: Conversation Compaction

Source: `langgraph_app/app/nodes/website/compactConversation.ts`

LLM-based summarization of old messages. Triggers when conversation grows too long.

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `messageThreshold` | 30 | Human turns before compaction triggers |
| `keepRecent` | 20 | Recent human turns preserved (not summarized) |
| `maxChars` | 200,000 | Character ceiling for forced compaction |

Key invariants:
- Atomic message groups (tool_call pairs) are NEVER split
- Existing summaries folded into new summary — always exactly ONE summary at any time
- Summary stored as `AIMessage(name="context")` — filtered from UI, excluded from `lastAIMessage()`
- Old context events are removed (re-injected fresh by `injectAgentContext`)
- Neutral third-person voice: *"The user requested... The assistant built..."*

### Layer 4: deepagents Internal Summarization

Built into `createDeepAgent()` — triggers at 170K tokens, keeps 6 messages. Acts as emergency compaction within a single agent run. Our graph-level compaction handles cross-run history.

### Key Ordering Insight

Context messages FIRST, then conversation. This ensures `[summary] [conversation]` layout, which maximizes prompt cache hits because the summary prefix is stable between turns.

---

## 8. Context Injection: Out-of-Band Data

Source: `langgraph_app/app/api/middleware/context/injectAgentContext.ts`

How the agent learns about things that happened outside the conversation (e.g., brainstorm completed, images generated).

### Pattern

1. Find last AI message timestamp
2. Fetch events from Rails API since that timestamp
3. Summarize events into context messages
4. Inject before the user's current input message

### Event Types

Each graph subscribes to specific event types (e.g., `brainstorm.finished`, `images.created`). Only subscribed events are fetched.

### Multimodal Support

Image events create multimodal context messages (text + `image_url` blocks) via `createMultimodalContextMessage()`.

### Key Design Decision

Runs WITHIN the node's `AsyncLocalStorage` context, not as stream middleware. Why: this preserves Polly.js recording (for tests) and billing context. Stream middleware runs outside the async context and loses these.

---

## 9. Error Handling: Five Layers

Each layer catches a different failure mode.

### Layer 1: Tool Error Surfacing

Source: `langgraph_app/app/core/llm/toolErrorSurfacingMiddleware.ts`

Catches tool execution errors → returns as `ToolMessage(status: "error")`. MUST be first middleware (wraps outermost `wrapToolCall` layer).

Without this: tool errors become `MiddlewareError` and crash the agent. With it: the LLM sees the error and decides whether to retry with different args, skip, or take another approach. This is NOT a retry mechanism — it's error visibility.

### Layer 2: Model Fallback

Source: `langgraph_app/app/core/llm/unavailableModelFallbackMiddleware.ts`

On availability errors (500, 502, 503, 504, 529), falls back to the next model in chain. Transparent to the agent — same interface, different provider.

Critical distinction: 429 (rate limit) does NOT trigger fallback unless the error message contains overload patterns. Non-recoverable errors (`invalid_api_key`, `authentication`, `content_policy`, `context_length_exceeded`) are never retried.

### Layer 3: Single-Shot Escalation

In `agent.ts:363-366`: if all edits fail after retry, escalate to the full agent. User sees *"This change needs a bit more work — taking a closer look..."*

### Layer 4: Node-Level Error Handling

In graph nodes: catches node execution errors, stores in state. Prevents one node failure from killing the whole graph.

### Layer 5: Durability Catch

In `createCodingAgent` (`agent.ts:302-321`): try/catch around the entire agent invocation. Logs + reports to Rollbar. Returns user-friendly message: *"I ran into an issue processing your request. Could you try again?"*

NEVER lets an unhandled error leave the user with no response.

---

## 10. Build Error Surfacing: Frontend → Agent Loop

How WebContainer build errors feed back to the agent.

### Error Parsing

Source: `rails_app/app/javascript/frontend/lib/webcontainer/errorParsing.ts`

Pattern-matched error extraction:
- esbuild blocks: split on `✘ [ERROR]`, extract message + file + code frame
- Vite resolution errors: `Failed to resolve import`, `No matching export`
- SyntaxError, Pre-transform errors
- ANSI stripped, noise filtered (`ExperimentalWarning`, `DeprecationWarning`)

### Stale Error Clearing

When files are written incrementally, Vite may show transient errors (e.g., component imported before it's written). The `processViteChunk()` function handles this:

```typescript
// errorParsing.ts:232-239
export function processViteChunk(text: string): ViteChunkResult {
  const errors = parseBuildErrors(text);
  return {
    errors,
    clearsErrors: errors.length === 0 && isSuccessfulRebuild(text),
  };
}
```

When Vite outputs `[vite] (hmr update|page reload)` with no new errors, all previous build errors are cleared. The iframe also posts `preview-ready` message on successful render.

### Agent Feedback Loop

If build errors exist and the user clicks "Fix errors", the frontend sends console errors as context. `resolveRoute()` detects `consoleErrors` with `type === "error"` and routes to the full agent (never single-shot for bugs).

---

## 11. Streaming: Real-Time Progress

### The Problem

Parent agent dispatches 4-6 parallel subagents. `Promise.all()` blocks until all complete. User sees nothing for ~60-90 seconds.

### The Solution

LangGraph's `writer()` writes directly to SSE output, bypassing `Promise.all()`. The 5-layer streaming architecture:

```
Layer 1: Backend (deepagentsjs) — emit __state_patch__ per completed subagent
Layer 2: Graph reducer — merge-by-id with status priority (completed > in_progress > pending)
Layer 3: SDK Server — convert __state_patch__ → data-state-patch-{key} SSE events
Layer 4: SDK Client — StateManager processes patches with caller-defined merge reducers
Layer 5: Frontend — todosMerge/filesMerge reducers, re-render on each patch
```

### Status Priority Invariant

Source: `shared/state/website.ts`

Todo status NEVER downgrades. The merge reducer assigns numeric priority and always takes the higher value:

```typescript
const STATUS_PRIORITY: Record<string, number> = {
  pending: 0,
  in_progress: 1,
  completed: 2,
};
```

Same logic on backend (`todosMerge` in `shared/state/website.ts:26`) and frontend, ensuring convergence regardless of patch ordering.

### Progressive Files

Files enter graph state immediately after single-shot edits via `collectDirtyFiles()` (`singleShotEdit.ts:411-431`) instead of waiting for `syncFiles` at graph end. The user sees the preview update sooner.

---

## 12. Non-Technical Abstraction

The user is assumed non-technical. This is enforced at multiple levels:

**Prompt-level**: The role prompt says NEVER mention exports, imports, components, props, syntax, JSX, TypeScript, file names, file paths, tools, or subagents.

**Todo-level**: Todo override middleware says *"keep todos high-level and clear. Do not reference specific files or directories."*

**Error messages**: `"I ran into an issue"` not `"TypeError: Cannot read property 'default' of undefined"`

**Escalation messages**: `"This change needs a bit more work"` not `"Single-shot str_replace failed, escalating to multi-turn agent"`

---

## 13. Design System Integration

How the agent maintains design consistency.

### Theme Colors

Source: `langgraph_app/app/prompts/coding/shared/design/themeColors.ts`

Semantic shadcn classes (`bg-primary`, `text-foreground`) resolved to CSS custom properties. The prompt includes a mapping table so the LLM knows what each class resolves to visually.

Section backgrounds are restricted: ONLY `bg-background`, `bg-muted`, or `bg-primary`. Never `bg-secondary`, `bg-accent`, or `bg-card` for full-width sections. This was learned from production: models would use `bg-accent` for sections and produce garish results.

Recommended rhythm: Hero (`bg-primary`) → Features (`bg-muted`) → Social proof (`bg-background`) → Pricing (`bg-muted`) → CTA (`bg-primary`).

### CSS Variables

Full HSL values from the theme's `semanticVariables` are included in the single-shot prompt (`singleShotEdit.ts:99-111`). For color scheme changes, the `change_color_scheme` tool edits `src/index.css` variables with proper WCAG contrast ratios — the LLM is instructed to never manually edit CSS variables for theme-wide changes.

### Typography

Theme-specific typography recommendations included as a dynamic suffix to the prompt. This is cache-busting (different per theme) but small enough that the cost is negligible.

### Tracking

`L10.createLead()` calls must NEVER be removed. This is enforced in both the full agent prompt and single-shot prompt: *"NEVER remove L10.createLead() calls or tracking imports."*

---

## 14. What's Missing: Gap Analysis vs. World-Class

### Critical Gaps (not yet built)

- **No 429 retry with exponential backoff** — rate limits currently kill requests outright
- **No graph-level timeout** — a hung LLM stream can block indefinitely
- **No per-run cost ceiling** — the agent can theoretically burn unlimited credits in one invocation
- **No stuck/loop detection** — if the agent repeats the same failing tool call, nothing stops it except `recursionLimit: 150`
- **No partial completion on failure** — if the agent crashes mid-way through a create flow, the user loses all progress
- **No status opacity relief** — users see "running" with no "retrying..." or "switching to backup model..." detail

### High-Value Gaps

- **No circuit breaker per provider** — one provider outage can block all requests
- **No emergency compaction** — context overflow is rare but fatal (deepagents' 170K trigger is the only safety net)
- **No output validation** — bad code (broken JSX, missing imports) is silently saved
- **No LLM routing by capability** — same model tier for all task types
- **No chaos testing framework** — we can't simulate provider failures in test
- **No LangSmith structured metadata** — failure patterns aren't dashboardable

### Aspirational (researched but deferred)

- Cost-optimized routing (cheap model first, escalate on quality drop)
- Quality-adaptive routing (ensemble voting, speculative execution)
- Graceful degradation / feature shedding under load
- Semantic caching for similar requests
- Prompt injection detection

---

## 15. Meta-Lessons from Production

### Lesson 1: Simple architectures beat complex ones under stress

ReliabilityBench (Jan 2026) found simple agents with basic retry/fallback outperform complex multi-agent systems during provider outages. Our middleware-first, composable approach aligns with this — each middleware does one thing, and they compose cleanly.

### Lesson 2: The system must guarantee termination

Models cannot reliably detect their own loops. Hard limits (recursion limits, timeouts) must exist at the framework level. We have `recursionLimit: 150` but lack wall-clock timeouts — this is a known gap.

### Lesson 3: Silent failures are deadlier than loud crashes

Anthropic's TPU bug silently degraded code quality for weeks before anyone noticed. We need output validation and quality heuristics, not just error catching. The current system catches *errors* well but has no concept of *quality degradation*.

### Lesson 4: Provider outages are correlated

LLM providers share infrastructure (cloud regions, GPU clusters). Multi-provider fallback is necessary but insufficient when multiple providers go down simultaneously. We need circuit breakers + graceful degradation.

### Lesson 5: The 100x cost difference makes routing the highest-leverage optimization

Single-shot is ~$0.005. Full agent is ~$0.50. Getting routing right saves more money than any other optimization. The classifier must be fast, cheap, and conservative (default to expensive when uncertain). Even a 10% improvement in routing accuracy can save thousands per month at scale.

---

## Appendix: Key File Paths

| Component | Path |
|-----------|------|
| Website graph | `langgraph_app/app/graphs/website.ts` |
| Intent graph factory | `langgraph_app/app/graphs/shared/createIntentGraph.ts` |
| Coding agent (routing + dispatch) | `langgraph_app/app/nodes/coding/agent.ts` |
| Single-shot edit | `langgraph_app/app/nodes/coding/singleShotEdit.ts` |
| Coder subagent | `langgraph_app/app/nodes/coding/subagents/coder.ts` |
| Message sanitization | `langgraph_app/app/nodes/coding/messageUtils.ts` |
| Context window | `langgraph_app/app/nodes/website/contextWindow.ts` |
| Conversation compaction | `langgraph_app/app/nodes/website/compactConversation.ts` |
| Context injection | `langgraph_app/app/api/middleware/context/injectAgentContext.ts` |
| Prompt caching middleware | `langgraph_app/app/core/llm/promptCachingMiddleware.ts` |
| Tool error surfacing | `langgraph_app/app/core/llm/toolErrorSurfacingMiddleware.ts` |
| Model fallback | `langgraph_app/app/core/llm/unavailableModelFallbackMiddleware.ts` |
| Theme colors prompt | `langgraph_app/app/prompts/coding/shared/design/themeColors.ts` |
| Error parsing (frontend) | `rails_app/app/javascript/frontend/lib/webcontainer/errorParsing.ts` |
| State merge reducers | `shared/state/website.ts` |
