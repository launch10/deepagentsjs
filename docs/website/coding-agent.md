# Coding Agent

The coding agent generates and edits landing pages. It uses a three-tier routing system: an **LLM classifier** decides whether an edit is simple or complex, then routes to either a **single-shot edit** (one fast LLM call) or the **full agent** (multi-turn with tools and subagents). Failed single-shot edits auto-escalate to the full agent.

## Decision Tree

```
User message arrives
       │
       ▼
┌─────────────────┐
│ Is first message │──yes──→ FULL AGENT (create flow)
│ (create flow)?   │
└────────┬────────┘
         │ no
         ▼
┌─────────────────┐
│ Errors present?  │──yes──→ FULL AGENT (bugfix mode)
└────────┬────────┘
         │ no
         ▼
┌─────────────────┐
│ Custom prompt?   │──yes──→ FULL AGENT (SEO, etc.)
│ (systemPrompt)   │
└────────┬────────┘
         │ no
         ▼
┌─────────────────┐
│ Image in context?│──yes──→ FULL AGENT (multi-file)
└────────┬────────┘
         │ no
         ▼
┌─────────────────────────┐
│ classifyEditWithLLM()   │
│ (cheapest model, file   │
│  tree only, no content) │
└────────┬────────────────┘
    ┌────┴────┐
  SIMPLE    COMPLEX
    │         │
    ▼         ▼
 Single-    Full
 Shot Edit  Agent
    │
    │ (if ALL edits fail after retry)
    └──────→ ESCALATE to Full Agent
```

## Single-Shot Edit

**Cost:** ~$0.005 | **Model:** Haiku (speed: "blazing", maxTier: 2) | **One LLM call**

1. Build file tree via `globInfo("**/*")`
2. Pre-read all source files (`src/**/*.{ts,tsx,css}`, excluding `/ui/` shadcn components)
3. Build system prompt with file contents + theme colors + design guidance (~28K tokens, 95% cached)
4. Invoke LLM once with native Anthropic `text_editor_20250728` tool
5. Filter out `view` commands (files already pre-loaded), apply `str_replace`/`create`/`insert`
6. On total failure: retry once with error context. If retry fails: escalate to full agent

## Full Agent

**Cost:** ~$0.10–0.50 | **Model:** Sonnet (speed: "slow", cost: "paid") | **Multi-turn with tools**

Built via `createDeepAgent()` with filesystem tools + coder subagent + icon search.

**Tools available:**
- Filesystem: `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`
- `task(subagent_type="coder", task="...")` — delegates component work in parallel
- `searchIcons(queries, limit)` — semantic Lucide React icon search

**Workflow modes:**
- **Create:** Plans sections from brainstorm → launches parallel coder subagents → assembles IndexPage.tsx
- **Edit:** Reads existing code → plans changes → delegates parallel edits
- **Bugfix:** Analyzes errors → locates files → makes minimal fix → verifies

**Middlewares (in order):**
1. `createToolErrorSurfacingMiddleware()` — catches errors before ToolNode crash
2. `createPromptCachingMiddleware()` — caches system prompt + tool definitions
3. `summarizationMiddleware` — compresses context at 170K tokens

## Website Graph

The website graph routes by intent to three subgraphs:

| Intent | Subgraph | Description |
|--------|----------|-------------|
| `change_theme` | themeHandler | Silent CSS variable swap, no AI |
| `improve_copy` | improveCopy | Regenerate marketing copy |
| default | websiteBuilder | Full build (create/edit/bugfix) → coding agent |

The default subgraph fans out: `buildContext` → parallel `websiteBuilder` + `recommendDomains` → `cleanupFilesystem` → `syncFiles`.

## Key Files Index

| File | Purpose |
|------|---------|
| `langgraph_app/app/nodes/coding/agent.ts` | Main agent factory, routing logic, classifier |
| `langgraph_app/app/nodes/coding/singleShotEdit.ts` | Single-shot edit execution |
| `langgraph_app/app/nodes/coding/fileContext.ts` | File tree and context utilities |
| `langgraph_app/app/nodes/coding/subagents/coder.ts` | Coder subagent definition |
| `langgraph_app/app/nodes/website/websiteBuilder.ts` | Entry point node (detects create vs edit) |
| `langgraph_app/app/graphs/website.ts` | Website graph with 3 subgraphs |
| `langgraph_app/app/prompts/coding/agent.ts` | Main prompt builder |
| `langgraph_app/app/prompts/coding/shared/workflow.ts` | Create/Edit/BugFix mode instructions |
| `langgraph_app/app/prompts/coding/shared/tools.ts` | Tool documentation for agent prompt |
| `langgraph_app/app/prompts/coding/shared/design/themeColors.ts` | Theme color guidance for AI |

## Gotchas

- **File paths from `globInfo()` start with `/`** (e.g., `/src/App.tsx`). Use `includes("src/")` not `startsWith("src/")`.
- **`IndexPage.tsx` is the composition root**, not `App.tsx`. The `website_generated` snapshot uses this pattern.
- **`max_tokens: 4096`** is set in `createModel()` in `langgraph_app/app/core/llm/service.ts`. Was 2048, increased to prevent truncation.
- **Single-shot excludes `/ui/` directory** (shadcn components) from pre-loaded context to stay within token limits.
- **Escalation is one-way**: single-shot → full agent. The full agent never downgrades to single-shot.
