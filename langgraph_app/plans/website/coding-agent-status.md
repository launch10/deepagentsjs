# Coding Agent — State of the Agent

**Last updated**: 2026-02-06
**Branch**: `superlight-edit-agent`

---

## 1. System Architecture

The website builder is an **intent-routed state graph** that dispatches to specialized subgraphs:

```
Website Graph (intent router)
├─ change_theme  → themeHandlerSubgraph  (silent, no AI)
├─ improve_copy  → improveCopySubgraph   (Haiku single-shot, ~$0.005)
└─ default       → websiteBuilderSubgraph (classifier → single-shot or full agent)
```

### Default Subgraph (websiteBuilderSubgraph)

```
START → buildContext ──┬──→ websiteBuilder → compactConversation → cleanupFilesystem → syncFiles → END
                       └──→ recommendDomains ────────────────────→ cleanupFilesystem ──────────────↗
```

- `buildContext` fans out to `websiteBuilder` and `recommendDomains` **in parallel**
- Both converge at `cleanupFilesystem` → `syncFiles` → END
- Cache mode short-circuits: `recommendDomains` → `skipToEnd` → END

### Key Files

| File | Purpose |
|------|---------|
| `app/graphs/website.ts` | Graph definition, intent routing, subgraph composition |
| `app/annotation/websiteAnnotation.ts` | State type (messages, files, intent, theme, etc.) |
| `app/graphs/shared/createIntentGraph.ts` | `createIntentGraph` utility |
| `app/graphs/shared/withCreditTracking.ts` | Credit tracking wrapper |

---

## 2. Coding Agent Core

The coding agent uses a **classifier → single-shot → full agent** escalation pattern:

1. **Classifier** (Tier 5, cheapest model) — Routes user edits as "simple" or "complex"
2. **Single-shot edit** (Haiku, maxTier 2) — Pre-loads all `src/` files, makes ONE LLM call with native `text_editor_20250728`
3. **Full coding agent** (Sonnet) — Multi-turn deepagents loop with subagents for complex tasks

### Route Resolution (`agent.ts:163-196`)

| Condition | Route | Why |
|-----------|-------|-----|
| First message (create flow) | full | Needs exploration + parallel subagents |
| Errors present (bugfix) | full | Debugging needs tool loops |
| Custom systemPrompt | full | Single-shot has its own prompt |
| Classifier → "simple" | single-shot | Targeted 1-3 file edits |
| Classifier → "complex" | full | Structural changes, multi-file refactors |
| Classifier failure | full | Safer to overshoot |

### Escalation & Retry

- Single-shot: on total failure (`successCount === 0`), retries once with error context + current file contents
- If retry also fails (`allFailed: true`), websiteBuilderNode falls through to full agent
- Full agent has `recursionLimit: 150` (create) / `50` (edit)

### Key Files

| File | Purpose |
|------|---------|
| `app/nodes/coding/agent.ts` | Unified entry point, route resolution, full agent builder |
| `app/nodes/coding/singleShotEdit.ts` | Single-shot edit path (Haiku + native text_editor) |
| `app/nodes/coding/fileContext.ts` | `buildFileTree`, `preReadFiles` shared utilities |
| `app/nodes/coding/subagents/coder.ts` | Coder subagent (only subagent, inherits parent model) |

---

## 3. All Execution Paths

### 3a. Theme Handler (`change_theme` intent)

- **Cost**: ~$0 (no LLM calls)
- **Flow**: Extract `themeId` → Rails API updates website theme → Rails regenerates `src/index.css` with new CSS variables → fetch updated `index.css` from DB → return single file
- **File**: `app/nodes/website/themeHandler.ts`

### 3b. Improve Copy (`improve_copy` intent)

- **Cost**: ~$0.005 (Haiku single-shot, forced route)
- **Styles**: `professional`, `friendly`, `shorter`, or default `improve`
- **Flow**: Get style-specific prompt → inject brainstorm context (brand voice) → `createCodingAgent({ route: "single-shot" })` → sync files
- **File**: `app/nodes/website/improveCopy.ts`

### 3c. Default — Create Flow (first message)

- **Cost**: ~$0.80 per create (Sonnet full agent)
- **Flow**: `buildContext` (inject brainstorm + images via events, add "Create a landing page" instruction) → full agent with `recursionLimit: 150` → parallel subagent delegation → compaction → sync files
- **Parallel**: Domain recommendations run concurrently via fan-out from `buildContext`

### 3d. Default — Edit Flow (subsequent messages)

- **Cost**: $0.005 (simple) to $0.30 (complex)
- **Flow**: `buildContext` (window to 10 turn pairs / 40K chars) → classifier → single-shot or full agent with `recursionLimit: 50` → compaction → sync files

### 3e. Default — Bug Fix (errors present)

- **Cost**: $0.10-0.30 (full agent)
- **Flow**: Errors in state → routes to full agent (no classifier) → bugfix workflow prompt → fix → verify → sync files
- **File**: `app/prompts/coding/shared/workflow.ts` (bugfix workflow)

### 3f. Cache Mode (testing optimization)

- **Cost**: $0 (no LLM calls)
- **Controlled by**: `CACHE_MODE` env var, create flow only
- **Flow**: Return pre-cached landing page files → skip domain recommendations → END
- **File**: `app/nodes/website/cacheMode.ts`

---

## 4. Prompt Architecture

### Static Prefix (cached, ~28K tokens)

Built by `buildStaticContextPrompt()` in `app/prompts/coding/agent.ts`:

| Component | File | Content |
|-----------|------|---------|
| User Goal | `shared/goal.ts` | Validate business idea via landing page |
| Role | `shared/role.ts` | Expert landing page developer persona |
| Context | `shared/context.ts` | Available context (brainstorm, theme, images) |
| Tools | `shared/tools.ts` | Filesystem, subagents (task), searchIcons |
| Links | `shared/links.ts` | Link formatting guidance |
| Icons | `shared/icons.ts` | Icon search guidance |
| Images | `shared/images.ts` | Image placement strategy |
| Code Guidelines | `shared/codeGuidelines.ts` | React/TypeScript conventions |
| Tracking | `shared/tracking.ts` | L10.createLead() analytics API |
| Design Colors | `shared/design/themeColors.ts` | Semantic color classes |
| Design Animations | `shared/design/animations.ts` | Hover & transition patterns |
| Design Fonts | `shared/design/fonts.ts` | Typography sizes & spacing |
| Design Environment | `shared/environment.ts` | Runtime environment info |
| Design Philosophy | `shared/design/designPhilosophy.ts` | Anti-AI-slop, bold aesthetics (from SKILL.md) |
| Design Checklist | `shared/design/designChecklist.ts` | Quality verification checklist |

**Caching**: Marked with `cache_control: { type: "ephemeral" }` → reused across requests within 5-min window at 10% of input token cost.

### Dynamic Suffix (per-request)

Built by `buildCodingPrompt()`:

| Component | File | Varies By |
|-----------|------|-----------|
| Workflow | `shared/workflow.ts` | Create / Edit / BugFix mode |
| Start By | `shared/workflow.ts` | Mode-specific first action |
| Typography | `shared/design/typography.ts` | Theme-specific font recommendations |

### Single-Shot Prompt (separate path)

Built by `buildSingleShotSystemMessage()` in `singleShotEdit.ts`:
- Critical rules (one response, files pre-loaded, no view commands)
- Design guidance (theme colors + CSS vars + typography + animations)
- Design philosophy (cached)
- File tree + all pre-read file contents
- All in one SystemMessage with `cache_control`

---

## 5. Backend & File Operations

### WebsiteFilesBackend (`app/services/backends/websiteFilesBackend.ts`)

**Purpose**: Virtual filesystem bridging database ↔ agent tools

**Hydration**:
1. Load `code_files` from DB for the website
2. If none exist (create flow), fall back to `template_files` for the website's template
3. Write all files to disk at `agents/websites/<accountId>/<website_name>/`

**Operations**:
- `read(path)` — Raw content without line numbers (avoids agent confusion)
- `write(path, content)` — Dual-write: filesystem + Rails API → DB. Uses RedisLock per file.
- `edit(path, old, new)` — Dual-write with enhanced error logging (whitespace mismatch detection)
- `globInfo(pattern)` — Delegates to FilesystemBackend
- `grepRaw(pattern)` — Uses PostgreSQL full-text search (`content_tsv`) + regex line matching

**Key Design Decisions**:
- Raw content (no line numbers) prevents agents from including line numbers in str_replace anchors
- RedisLock per file prevents concurrent write conflicts from parallel subagents
- Debug logging to `/tmp/website_files_backend.log` for operation tracing

---

## 6. Conversation Management

### 3-Layer Compaction

| Layer | Trigger | Strategy | Cost | File |
|-------|---------|----------|------|------|
| Context window | Edit flow | Window to 10 turn pairs / 40K chars, always preserve context events | $0 | `contextWindow.ts` |
| Conversation compaction | >12 non-context msgs OR >100K chars | Summarize old msgs with Tier 5 LLM, keep 6 recent + summary | ~$0.001 | `compactConversation.ts` |
| Deepagents upstream | 170K token limit | Internal summarization, keep 6 messages | $0 | Built into deepagents |

### Message Deduplication (`agent.ts:258-274`)

Full agent returns many internal messages. Only first and last AI messages are returned to the caller:
- First AI = personalized greeting (create) or initial response (edit)
- Last AI = final summary of changes
- Deduplicated if only one AI message exists

### Context Events

- Injected via `injectAgentContext()` from Rails events (brainstorm.finished, images.created, etc.)
- Always preserved through compaction (never summarized)
- Marked with `name: "context"` and filtered from UI

---

## 7. Verified Cost Model

From test assertions (not estimates):

| Operation | Measured Cost | LLM Calls | Assertion Source |
|-----------|--------------|-----------|-----------------|
| Edit (total, w/ classifier) | < $0.02 | 2-4 | `website.test.ts:315,317` |
| Single-shot edit (Haiku) | ~$0.005 | 1 | `singleShotEdit.test.ts:13` |
| Classifier | ~$0.0001 | 1 | Tier 5 cheapest model |
| Improve copy | ~$0.005 | 1 | Haiku single-shot |
| Theme change | ~$0 | 0 | No LLM calls |
| Bug fix (full agent) | $0.10-0.30 | Multi-turn | `bugFix.eval.test.ts:17` |
| Create (full agent) | ~$0.80 | Multi-turn | `website.eval.ts:13` |
| Compaction | ~$0.001 | 1 | Tier 5 cheapest model |
| Domain recommendations | $0.01-0.05 | Multi-turn | Slow model, agent loop |

---

## 8. LLM Service Configuration

### Model Selection (`app/core/llm/service.ts`)

```
LLMService.get(skill, speed, cost, usagePercent, maxTier)
  → fetchConfig() from Rails API (cached 5min in Redis)
  → filter by: preferences → enabled → usage threshold → price tier → valid cost config
  → createModel() with provider-specific LangChain class
```

**Key Settings**:
- `maxTokens: 4096` (overrides LangChain default of 2048)
- `temperature: 0` (except GPT-5/GPT-5 mini which don't support it)
- WORKAROUND: Clear `topP`/`topK` for Anthropic models (LangChain bug)

**Price Tiers**: 1 = most expensive (Sonnet, GPT-4) → 5 = cheapest (Haiku, Groq)

**Providers**: Anthropic, OpenAI, Groq, Ollama

**maxTier Merging**: `explicit maxTier` vs `LLM_MAX_TIER` env → use MORE RESTRICTIVE (higher number)

### Models Used by the Coding Agent

| Component | getLLM params | Resolves To | Purpose |
|-----------|--------------|-------------|---------|
| Classifier | `skill: "coding", speed: "blazing", cost: "paid", maxTier: 5` | Haiku / cheapest | Route decision |
| Single-shot edit | `skill: "coding", speed: "blazing", cost: "paid", maxTier: 2` | Haiku | One-call file edits |
| Full agent | `skill: "coding", speed: "slow", cost: "paid"` | Sonnet | Multi-turn generation |
| Coder subagent | Inherited from parent | Sonnet (via deepagents) | Component implementation |
| Compaction | `skill: "coding", speed: "blazing", cost: "paid", maxTier: 5` | Haiku / cheapest | Summarization |

---

## 9. Billing & Token Tracking — All Fixed

| Area | Status | Evidence |
|------|--------|----------|
| Token double-counting | **FIXED** — Reads raw `response_metadata.usage` (not LangChain's merged/doubled values) | `tracker.ts:140,176-183` |
| Subagent tracking | **WORKING** — `getLLM()` wraps models with `configFactories` containing `usageTracker`. Survives `bindTools()`, `withStructuredOutput()`, and deepagents model forwarding. | `llm.ts:107-124`, `coder.ts:14-21`, `usageTrackingIntegration.test.ts:459-529` |
| Failed run persistence | **WORKING** — `usageTrackingMiddleware.onComplete()` fires regardless of success/failure | `usageTracking.ts:78-134`, `error-after-llm` test scenario |

### Historical context

All three bugs were documented in `plans/cost.md` (2026-02-04) and fixed on this branch. That document is now marked as historical.

---

## 10. Prompt Caching — Working

| Layer | Mechanism | Code Reference |
|-------|-----------|----------------|
| Custom middleware | `promptCachingMiddleware.ts` handles `StructuredOutputRunnableBinding` unwrapping via `isAnthropicModel()` | `agent.ts:44`, `isAnthropicModel.ts:28` |
| Single-shot manual | `cache_control` on system message + tool definition | `singleShotEdit.ts:227-232` |
| 3-tier strategy | System prompt, tools, conversation prefix all cached | `promptCachingMiddleware.ts` |

### Why the original bug is fixed

The original bug: `anthropicPromptCachingMiddleware` checked `getName() === "ChatAnthropic"` but our models are wrapped in `StructuredOutputRunnableBinding` (returns `"RunnableBinding"`).

Fix: Custom `promptCachingMiddleware.ts` uses `isAnthropicModel()` which unwraps the binding to find the actual `ChatAnthropic` instance inside.

---

## 11. Tools

### Native Text Editor (`text_editor_20250728`)

- **Injected by**: `textEditorMiddleware.ts` (wrapModelCall adds tool definition, wrapToolCall intercepts calls)
- **Anthropic models**: Native tool type (Claude fine-tuned on this, ~90%+ first-attempt success)
- **Non-Anthropic models**: Fallback JSON-schema tool with same interface
- **Commands**: `view`, `str_replace`, `create`, `insert`
- **Implementation**: `textEditorTool.ts` — bridges native tool calls to `WebsiteFilesBackend`

### SearchIconsTool

- Searches Lucide React icon library by concept
- Available to full agent and coder subagent

---

## 12. Single-Shot Edit Response Quality

The single-shot edit prompt explicitly instructs the LLM (step 4):

> "Write a brief (1-2 sentence) confirmation of what you changed"

Claude follows this instruction and produces descriptive responses. The fallback message (`"I've made the requested changes..."`) only fires if the LLM returns zero text blocks (`singleShotEdit.ts:346-357`).

---

## 13. Validate Links (post-generation)

- **File**: `app/nodes/website/validateLinks.ts`
- **Purpose**: Check for broken internal links after generation
- **Max retries**: 2 (per `errorRetries` state counter)
- **Flow**: Fetch files from DB → `validateLinks(files)` → if errors and retries < 2, inject error message for agent to fix
- **Note**: Currently defined but NOT wired into the website graph (available for future use)

---

## 14. Test Coverage

| Test File | Tests | Type | What It Tests |
|-----------|-------|------|---------------|
| `singleShotEdit.test.ts` | 30+ | Eval | Classifier routing (25 simple + 12 complex), single-shot execution, tracking preservation |
| `singleShotEdit.unit.test.ts` | 7 | Unit | Error handling, retry logic, partial failure, rollbar reporting (all mocked) |
| `textEditorTool.test.ts` | 16 | Unit | All text editor commands, edge cases, content preservation |
| `website.eval.ts` | 8 | Eval | Quality scorers: design, completeness, persuasiveness (evalite, ~$5-8/run) |
| `website.test.ts` | 6+ | Integration | Full create/edit pipeline, cost assertions, message trimming, theme changes |
| `bugFix.eval.test.ts` | 5 | Eval | Bug injection → fix → verification with pre/post assertions |
| `domainRecommendations.test.ts` | 2+ | Integration | Domain recommendation generation during creation |
| `usageTrackingIntegration.test.ts` | — | Integration | Token tracking accuracy, subagent propagation |

### Test Infrastructure

- **Polly.js**: 71 recording directories in `tests/recordings/`
- **Database snapshots**: `website_step` (pre-generation), `website_generated` (post-generation)
- **Sequential execution**: `fileParallelism: false` (Polly.js global singleton race condition)
- **Cost from recordings**: $0 (cached); re-recording requires API credits

---

## 15. Remaining Gaps

### 1. No visual validation

The agent cannot see its output. Quality is 100% prompt-dependent.

- **TODO**: `websiteBuilder.ts:122-129`
- **Concept**: screenshot → vision score → single-shot fix if score < 7
- **Scope**: Create flow only (not edits)

### 2. No cache hit verification test

Code is correctly instrumented with `cache_control` markers, but no test confirms Anthropic actually receives them and returns cache hits. A future LangChain update could silently break the middleware.

### 3. No cost-based circuit breaker

Full agent create has `recursionLimit: 150`. A confused agent could burn $5-7 before stopping. Consider adding a cost ceiling that triggers early termination.

---

## 16. Complete File Reference

### Coding Agent

| File | Purpose |
|------|---------|
| `app/nodes/coding/agent.ts` | Unified entry point, route resolution, full agent builder |
| `app/nodes/coding/singleShotEdit.ts` | Single-shot edit path (Haiku + native text_editor) |
| `app/nodes/coding/fileContext.ts` | `buildFileTree`, `preReadFiles` shared utilities |
| `app/nodes/coding/subagents/coder.ts` | Coder subagent definition |
| `app/nodes/coding/cleanupFilesystem.ts` | No-op (cleanup disabled) |

### Website Graph & Nodes

| File | Purpose |
|------|---------|
| `app/graphs/website.ts` | Graph definition, intent routing, subgraph composition |
| `app/nodes/website/websiteBuilder.ts` | Main orchestrator: context → coding agent → result |
| `app/nodes/website/buildContext.ts` | Context injection (brainstorm, images) via events |
| `app/nodes/website/improveCopy.ts` | Copy rewrite with style selection |
| `app/nodes/website/themeHandler.ts` | Silent theme update (no AI) |
| `app/nodes/website/compactConversation.ts` | Conversation summarization when too long |
| `app/nodes/website/contextWindow.ts` | Edit-flow message windowing (10 turns, 40K chars) |
| `app/nodes/website/recommendDomains.ts` | Parallel domain recommendations |
| `app/nodes/website/syncFiles.ts` | DB → state file synchronization |
| `app/nodes/website/validateLinks.ts` | Link validation (defined, not wired into graph) |
| `app/nodes/website/cacheMode.ts` | Testing optimization (pre-cached responses) |

### LLM & Infrastructure

| File | Purpose |
|------|---------|
| `app/core/llm/service.ts` | Model config from Rails, `createModel()`, maxTokens: 4096 |
| `app/core/llm/llm.ts` | `getLLM()` with usage tracking, `getLLMFallbacks()` |
| `app/core/llm/promptCachingMiddleware.ts` | 3-tier Anthropic prompt caching |
| `app/core/llm/isAnthropicModel.ts` | Model detection through wrappers |
| `app/core/llm/cost.ts` | Cost calculation (millicredits) |
| `app/core/billing/tracker.ts` | Raw Anthropic usage reading |
| `app/api/middleware/usageTracking.ts` | Usage tracking middleware |

### Prompts

| File | Purpose |
|------|---------|
| `app/prompts/coding/agent.ts` | Prompt composition (static + dynamic) |
| `app/prompts/coding/shared/workflow.ts` | Create / Edit / BugFix workflow instructions |
| `app/prompts/coding/shared/role.ts` | Agent persona |
| `app/prompts/coding/shared/goal.ts` | User goal context |
| `app/prompts/coding/shared/tools.ts` | Tool documentation |
| `app/prompts/coding/shared/design/designPhilosophy.ts` | Design philosophy (from SKILL.md) |
| `app/prompts/coding/shared/design/themeColors.ts` | Semantic color classes |
| `app/prompts/coding/shared/design/fonts.ts` | Typography sizes & spacing |
| `app/prompts/coding/shared/design/animations.ts` | Hover & transition patterns |
| `app/prompts/coding/shared/design/typography.ts` | Theme-specific font recommendations |
| `app/prompts/coding/shared/design/designChecklist.ts` | Quality verification |
| `app/prompts/coding/shared/design/imageStrategy.ts` | Image placement guidance |

### Tools

| File | Purpose |
|------|---------|
| `app/tools/website/textEditorTool.ts` | Text editor command execution |
| `app/tools/website/textEditorMiddleware.ts` | Native tool injection + call interception |

### Backend

| File | Purpose |
|------|---------|
| `app/services/backends/websiteFilesBackend.ts` | Virtual filesystem (DB ↔ disk ↔ agent) |
