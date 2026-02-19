# Agent Intents

Agent intents are the backend-to-frontend communication channel — the mirror of [user intents](../frontend/intents.md) which flow frontend-to-backend.

## Overview

```
UserIntents:   Frontend → Backend  (user clicks button → intent in state → graph routes by intent)
AgentIntents:  Backend → Frontend  (agent calls tool → agentIntents in state → frontend processes)
```

When an AI agent needs the frontend to take action (navigate, show a toast, open a panel), it writes an **agent intent** to graph state. The frontend watches for new intents and executes them.

## Architecture

### State

Agent intents live in `CoreGraphState.agentIntents` — an array of intent objects with replace semantics (each update replaces the entire array, same as `intent`).

```typescript
// shared/types/graph.ts
export type CoreGraphState = {
  // ... existing fields ...
  agentIntents: AgentIntent[] | undefined;
}
```

### Schema

All agent intents follow a common shape:

```typescript
// shared/types/agentIntent.ts
{ type: string, payload: Record<string, unknown>, createdAt: string }
```

Current intent types:

| Type | Payload | Description |
|------|---------|-------------|
| `navigate` | `{ page: WorkflowPage, substep?: string }` | Navigate to a workflow page |

### Backend: Writing Intents

Agents write intents by calling tools that return a `Command` with `agentIntents` in the state update:

```typescript
// langgraph_app/app/tools/shared/navigate.ts
export const navigateTool = tool(
  async (input, config) => {
    return new Command({
      update: {
        agentIntents: [{
          type: "navigate",
          payload: { page: input.page, substep: input.substep },
          createdAt: new Date().toISOString(),
        }],
        messages: [new ToolMessage({ ... })],
      },
    });
  },
  { name: "navigateTool", schema: z.object({ page: z.enum(WorkflowPages), substep: z.string().optional() }), returnDirect: true }
);
```

### Frontend: Processing Intents

The `useAgentIntentProcessor` hook watches graph state for new agent intents and executes them:

```typescript
// rails_app/.../hooks/useAgentIntentProcessor.ts
useAgentIntentProcessor(agentIntents, isStreaming);
```

Guards:
- **Skips while streaming** — waits for stable state before acting
- **Skips initial value** — prevents re-executing stale intents when revisiting a page

Page components opt in by reading `agentIntents` from their graph state selector and passing it to the hook.

## Usage Example: Brainstorm → Website Navigation

The brainstorm agent uses `navigateTool` to send users to the website builder when they're ready:

1. User completes all brainstorm questions (reaches `lookAndFeel` topic)
2. The Continue button enables with label "Build My Site"
3. **Click path**: User clicks "Build My Site" → standard workflow navigation
4. **Chat path**: User types "build my site" → agent calls `navigateTool({ page: "website" })` → frontend auto-navigates

## Adding New Intent Types

1. Add the schema to `shared/types/agentIntent.ts`:
   ```typescript
   export const toastAgentIntentSchema = z.object({
     type: z.literal("toast"),
     payload: z.object({ message: z.string(), level: z.enum(["info", "success", "error"]) }),
     createdAt: z.string(),
   });
   ```

2. Add it to the union and create a type guard + factory

3. Handle it in `useAgentIntentProcessor`:
   ```typescript
   if (isToastAgentIntent(intent)) {
     toast[intent.payload.level](intent.payload.message);
   }
   ```

4. Create a tool in `langgraph_app/app/tools/shared/` that writes the intent

## Key Files

| File | Purpose |
|------|---------|
| `shared/types/agentIntent.ts` | Schemas, types, guards, factories |
| `shared/types/graph.ts` | `agentIntents` on `CoreGraphState` |
| `langgraph_app/app/annotation/base.ts` | `agentIntents` annotation (replace reducer) |
| `langgraph_app/app/tools/shared/navigate.ts` | Navigate tool |
| `rails_app/.../hooks/useAgentIntentProcessor.ts` | Frontend intent processor |

## Design Decisions

- **Array with replace semantics** (not append): Each graph turn writes a fresh list. This avoids accumulating stale intents across turns.
- **Tool-based** (not node-based): Intents are written via tools so the LLM decides when to trigger them, matching the conversational flow.
- **`returnDirect: true`**: Navigate tool short-circuits the graph since the user is leaving the current page.
- **Initial-value guard**: The hook skips intents present when the component first mounts, preventing re-navigation when users go back to a completed page.
