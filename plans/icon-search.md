# Plan: Icon Search for Coding Agent

## Problem

The coding agent needs to find appropriate icons for landing page components (features, benefits, etc.). Currently it has no icon discovery capability.

## Current State

- `SearchIconsTool` and `SearchIconsService` exist in `TODO/` - fully built, tested
- Uses Lucide React library (~1000 icons)
- Semantic search via PostgreSQL pgvector + OpenAI embeddings
- Database tables exist: `iconEmbeddings`, `iconQueryCaches`
- `createDeepAgent` accepts a `tools` parameter for additional tools

## Solution (3 Steps)

### Step 1: Move Icon Services from TODO to Active

Move files:
- `TODO/tools/website/searchIcons.ts` → `app/tools/searchIcons.ts`
- `TODO/services/websites/searchIconsService.ts` → `app/services/searchIconsService.ts`

Fix imports and ensure `PostgresEmbeddingsService` is available.

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

### Step 3: Populate Icon Embeddings

Run embedding generation to populate `iconEmbeddings` table:

```typescript
// One-time seed script or migration
const service = new SearchIconsService();
await service.generateEmbeddings();
```

Options:
- Add to `pnpm run db:seed`
- Create migration that runs once
- Run manually via script

---

## Why This Works

1. **Tool already built** - Just needs to be moved from TODO
2. **deepagents supports tools** - `tools` param adds LangChain StructuredTools
3. **Agent gets semantic search** - Can find icons by concept, not just name
4. **Caching built-in** - 24-hour TTL reduces API calls

---

## Files to Modify

| File | Change |
|------|--------|
| `langgraph_app/app/tools/searchIcons.ts` | Move from TODO |
| `langgraph_app/app/services/searchIconsService.ts` | Move from TODO |
| `langgraph_app/app/nodes/codingAgent/utils/agent.ts` | Add tool to createDeepAgent |
| `langgraph_app/app/tools/index.ts` | Export SearchIconsTool |
| `langgraph_app/app/services/index.ts` | Export SearchIconsService |

---

## Dependencies

- ✅ `PostgresEmbeddingsService` - already active in `app/services/core/`
- ⚠️ Icon metadata files in `.data/lucide/icons/` - **need to be created/downloaded**
- ✅ OpenAI API key for embedding generation
- ✅ Database tables `iconEmbeddings`, `iconQueryCaches` - already in schema

### Icon Metadata & Embeddings Setup

**Check first:** Embeddings may already exist in `icon_embeddings` table.

```sql
SELECT COUNT(*) FROM icon_embeddings;
```

**If empty**, need to:
1. Download Lucide metadata files:
```bash
git clone --depth 1 https://github.com/lucide-icons/lucide.git /tmp/lucide
mkdir -p .data/lucide/icons
cp -r /tmp/lucide/icons/*.json .data/lucide/icons/
```

2. Run embedding generation:
```typescript
const service = new SearchIconsService();
await service.generateEmbeddings(); // ~1000 icons, batched
```

---

## What We're NOT Doing

- ❌ No new database tables (already exist)
- ❌ No new graph nodes
- ❌ No complex integration - just adding a tool
- ❌ No system prompt changes (tool is self-documenting)
