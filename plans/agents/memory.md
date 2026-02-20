# Agent Memory System

## Context

Agents lose cross-session context. Preferences, business insights, and instructions are buried in chat history or limited to brainstorm fields. We want a simple persistent memory system where agents can save and recall important context across conversations, scoped to the right level (project or account).

Philosophy: **Markdown is all an agent needs.** Each memory is a free-form text entry - no rigid categories or complex structure. The agent writes what it thinks is important, and it gets injected as context in future turns.

---

## Implementation Plan

### 1. Rails: Migration + Model

**New migration:**

```ruby
create_table :agent_memories do |t|
  t.references :account, null: false, foreign_key: true
  t.references :project, null: true, foreign_key: true
  t.bigint :project_group_id, null: true  # Ready for future
  t.string :scope, null: false             # "project" | "account"
  t.text :content, null: false             # Free-form markdown
  t.uuid :uuid, null: false, default: -> { "gen_random_uuid()" }
  t.timestamps
end

add_index :agent_memories, :uuid, unique: true
add_index :agent_memories, [:account_id, :scope]
add_index :agent_memories, [:account_id, :project_id]
```

**New model:** `rails_app/app/models/agent_memory.rb`
- `acts_as_tenant :account` (follows `AgentContextEvent` pattern)
- Validates scope (`project` or `account`), content presence + max 2000 chars
- Scope `for_context(project)` fetches project-level + account-level memories
- Add `has_many :agent_memories` to Account and Project models

### 2. Rails: API Controller

**New file:** `rails_app/app/controllers/api/v1/agent_memories_controller.rb`

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/agent_memories?project_id=X` | Fetch layered memories (project + account) |
| `POST /api/v1/agent_memories` | Create a memory |
| `PATCH /api/v1/agent_memories/:uuid` | Update content |
| `DELETE /api/v1/agent_memories/:uuid` | Delete a memory |

**Route** in `config/routes/api.rb` (after line 72):
```ruby
resources :agent_memories, only: [:index, :create, :update, :destroy], param: :uuid
```

### 3. Shared: API Service

**New file:** `shared/lib/api/services/agentMemoriesAPIService.ts`
- Follows `contextEventsAPIService.ts` pattern exactly
- Methods: `list()`, `create()`, `update()`, `destroy()`
- Export from `shared/lib/api/services/index.ts`

### 4. Langgraph: Memory Tool

**New directory:** `langgraph_app/app/tools/memory/`

One primary tool: **`save_memory`** - creates or updates a memory. Keep it dead simple.

```typescript
save_memory({
  content: string,     // Free-form text - whatever the agent thinks is important
  scope: "project" | "account",  // Where it applies
})
```

Plus **`delete_memory`** for cleanup (takes UUID).

The agent sees existing memories in its context (with UUIDs), so it can reference them for updates/deletes. No need for a separate `list_memories` tool since they're already injected every turn.

**Add tools to:**
- `langgraph_app/app/nodes/brainstorm/agent.ts` (tools array, line ~206)
- `langgraph_app/app/nodes/ads/agent.ts` (via `getTools()`)
- `langgraph_app/app/nodes/coding/agent.ts` (coding agent tools)

Export from `langgraph_app/app/tools/index.ts`.

### 5. Langgraph: Memory Context Injection

**Modify:** `langgraph_app/app/conversation/prepareTurn.ts`

Add exported `fetchMemoryContext()`:
- Calls `AgentMemoriesAPIService.list({ project_id })`
- Groups by scope, formats as one ContextMessage:
  ```
  [Memories]

  Account:
  - [uuid-1] User prefers a professional but approachable tone
  - [uuid-2] Always include social proof on landing pages

  Project:
  - [uuid-3] Target audience is busy parents aged 30-45
  - [uuid-4] Main competitor is BabySteps.com, differentiate on price
  ```
- Returns `[]` when no memories (zero cost)

**Injection points:**

| Agent | Change |
|-------|--------|
| **Website** (coding agent) | Modify top-level `prepareTurn()` to fetch memories in parallel with events. Memories first, events second. |
| **Brainstorm** | Call `fetchMemoryContext()`, prepend to `initialContextMessages` (line ~185) |
| **Ads** | Call `fetchMemoryContext()`, prepend to `contextMessages` (line ~38) |

### 6. Prompt Addition

Short section added to each graph's system prompt:

> You have persistent memory. Existing memories are shown in your context as `[Memories]`. You can save important things you learn using `save_memory`. Save preferences, important facts, or standing instructions that would be useful in future conversations. Don't save things already captured in brainstorm fields or transient details. Include the UUID when updating or deleting existing memories.

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `rails_app/db/migrate/..._create_agent_memories.rb` | **New** |
| `rails_app/app/models/agent_memory.rb` | **New** |
| `rails_app/app/models/account.rb` | Add `has_many :agent_memories` |
| `rails_app/app/models/project.rb` | Add `has_many :agent_memories` |
| `rails_app/app/controllers/api/v1/agent_memories_controller.rb` | **New** |
| `rails_app/config/routes/api.rb` | Add route |
| `shared/lib/api/services/agentMemoriesAPIService.ts` | **New** |
| `shared/lib/api/services/index.ts` | Add export |
| `langgraph_app/app/tools/memory/saveMemory.ts` | **New** |
| `langgraph_app/app/tools/memory/deleteMemory.ts` | **New** |
| `langgraph_app/app/tools/memory/index.ts` | **New** |
| `langgraph_app/app/tools/index.ts` | Add export |
| `langgraph_app/app/conversation/prepareTurn.ts` | Add `fetchMemoryContext()` + modify `prepareTurn()` |
| `langgraph_app/app/nodes/brainstorm/agent.ts` | Add tools + memory injection |
| `langgraph_app/app/nodes/ads/agent.ts` | Add tools + memory injection |
| `langgraph_app/app/nodes/coding/agent.ts` | Add tools (injection via prepareTurn) |

## Verification

1. **Rails**: Model spec (CRUD, scoping, validations) + request spec (all endpoints)
2. **Langgraph**: Tool unit tests with mocked API
3. **Manual**: Brainstorm session, state a preference, start new session, verify it appears in context
