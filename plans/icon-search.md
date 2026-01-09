---
status: approved
phase: 1e
effort: small
reviewers:
  - DHH Rails Reviewer
  - Kieran Rails Reviewer
  - Code Simplicity Reviewer
approved_date: 2026-01-08
---

# Plan: Icon Search for Coding Agent

## Problem

The coding agent needs to find appropriate icons for landing page components (features, benefits, etc.). Without semantic search, ~90% of agents invent fake Lucide icon names, creating jank in generated pages.

## Current State

- `SearchIconsTool` and `SearchIconsService` exist in `TODO/` - fully built, tested
- Uses Lucide React library (~1,400 icons)
- Semantic search via PostgreSQL pgvector + OpenAI embeddings
- **1,557 icon embeddings already seeded** in `icon_embeddings` table
- `createDeepAgent` accepts a `tools?: StructuredTool[]` parameter

## Solution (3 Steps)

### Step 1: Move Icon Services from TODO to Active

Move files:
- `TODO/tools/website/searchIcons.ts` → `app/tools/searchIcons.ts`
- `TODO/services/websites/searchIconsService.ts` → `app/services/searchIconsService.ts`

Update imports in `searchIcons.ts`:
```typescript
// Change FROM:
import { SearchIconsService, type IconResult } from "../../services/websites/searchIconsService";

// Change TO:
import { SearchIconsService, type IconResult } from "@services";
```

Remove unused `initSearchIcons()` function (lines 147-150) - dead code not used by this plan.

### Step 2: Add Tool to Coding Agent

In `app/nodes/codingAgent/utils/agent.ts`:

```typescript
import { SearchIconsTool } from "@tools";

export function createCodingAgent(state: CodingAgentGraphState) {
  // ... existing code ...

  return createDeepAgent({
    model: llm as any,
    name: "coding-agent",
    systemPrompt: CODING_AGENT_SYSTEM_PROMPT,
    backend: () => backend as any,
    subagents: [copywriterSubAgent, coderSubAgent],
    tools: [new SearchIconsTool()],  // ADD THIS
    middleware: middlewares as any,
    checkpointer: checkpointer as any,
  });
}
```

### Step 3: Move and Update Test File

Move test file:
- `tests/TODO/tools/searchIcons.test.ts` → `tests/tools/searchIcons.test.ts`

Update imports:
```typescript
// Change FROM:
import { initWebsiteTools } from 'app/tools/website';

// Change TO:
import { SearchIconsTool } from '@tools';
```

Update test setup:
```typescript
// Change FROM:
const tools = await initWebsiteTools({});
searchIconsTool = tools.searchIcons;

// Change TO:
searchIconsTool = new SearchIconsTool();
```

---

## Why This Works

1. **Tool already built** - Just needs to be moved from TODO
2. **deepagents supports tools** - `tools` param passes StructuredTools to agent and subagents
3. **Agent gets semantic search** - Can find icons by concept, not just name
4. **Embeddings already seeded** - 1,557 icons ready to query
5. **Caching built-in** - 24-hour TTL reduces API calls

---

## Files to Modify

| File | Change |
|------|--------|
| `langgraph_app/app/tools/searchIcons.ts` | Move from TODO, fix imports, remove dead code |
| `langgraph_app/app/services/searchIconsService.ts` | Move from TODO |
| `langgraph_app/app/nodes/codingAgent/utils/agent.ts` | Add tool to createDeepAgent |
| `langgraph_app/app/tools/index.ts` | Export SearchIconsTool |
| `langgraph_app/app/services/index.ts` | Export SearchIconsService |
| `langgraph_app/tests/tools/searchIcons.test.ts` | Move from TODO, update imports |

---

## Dependencies

- ✅ `PostgresEmbeddingsService` - already active in `app/services/core/`
- ✅ OpenAI API key for embedding generation
- ✅ Database tables `iconEmbeddings`, `iconQueryCaches` - already in schema
- ✅ **1,557 icon embeddings already seeded** - no setup needed

---

## What We're NOT Doing

- ❌ No new database tables (already exist)
- ❌ No new graph nodes
- ❌ No embedding generation (already seeded)
- ❌ No metadata file downloads (not needed)
- ❌ No system prompt changes (tool is self-documenting via LangChain schema)

---

## Review History

### Reviewers
- DHH Rails Reviewer
- Kieran Rails Reviewer
- Code Simplicity Reviewer

### Initial Feedback (Rejected)

All three reviewers initially questioned whether semantic search was necessary, suggesting:
- "Just add icon names to the system prompt"
- "LLMs already know Lucide icons"
- "This is overengineered - use substring matching"

### User Clarification

The user provided empirical evidence:
1. **90% of coding agents were inventing fake Lucide icon names** without semantic search
2. **~1,400 Lucide icons** makes long-tail discovery genuinely hard
3. **The semantic search works well in practice** - proven solution
4. **Wrong icons create appearance of jank** - unacceptable for the product

### Revised Feedback (Accepted)

With the approach validated, reviewers provided actionable implementation feedback:

| Issue | Decision |
|-------|----------|
| Import path will break after move | **Added to Step 1**: Change to `@services` alias |
| `initSearchIcons()` is dead code | **Added to Step 1**: Remove unused function |
| Test file needs to move | **Added Step 3**: Move and update test imports |
| Step 3 (populate embeddings) unnecessary | **Removed**: 1,557 embeddings already exist |
| Dependencies section about metadata | **Removed**: Not needed since embeddings exist |
| `icon: any` weak typing | **Deferred**: Separate cleanup ticket |
| Pre-existing `as any` casts | **Not relevant**: Existing tech debt, not caused by this plan |
| `createDeepAgent` API verification | **Confirmed**: `tools?: StructuredTool[]` works as planned |

### Final Review (2026-01-08) - APPROVED

All three reviewers approved the plan:

| Reviewer | Verdict | Key Feedback |
|----------|---------|--------------|
| DHH Rails Reviewer | **Ship it** | Correctly follows "LangGraph orchestrates, Rails executes"; scope is minimal |
| Kieran Rails Reviewer | **Approved** | Clean structure; consider domain-based service location |
| Code Simplicity Reviewer | **Proceed** | Excellent YAGNI discipline; single integration point |

**Action Items Before Implementation:**
- [ ] Verify tests pass after the move
- [ ] Decide service location: flat (`app/services/`) vs domain-based (`app/services/icons/`)
- [ ] Verify `DatabaseSnapshotter` test import works
- [ ] Add explicit export statements to index files

**Deferred:**
- Fix `icon: any` typing (separate ticket)
