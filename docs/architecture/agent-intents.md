# Agent Intents

Agent intents are the backend-to-frontend communication channel — the mirror of [user intents](../frontend/intents.md) which flow frontend-to-backend.

## Overview

```
UserIntents:   Frontend → Backend  (user clicks button → intent in state → graph routes by intent)
AgentIntents:  Backend → Frontend  (agent calls tool → agentIntents in state → frontend processes)
```

When an AI agent needs the frontend to take action (navigate, refresh brand panel data, etc.), it writes an **agent intent** to graph state. The frontend's `AgentIntentProcessor` watches for new intents and executes them.

## Architecture

### State

Agent intents live in `CoreGraphState.agentIntents` — an array of intent objects with replace semantics (each update replaces the entire array).

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
| `logo_set` | `{}` | Logo was set — refresh brand panel |
| `color_scheme_applied` | `{}` | Color scheme changed — refresh brand panel |
| `social_links_saved` | `{}` | Social links saved — refresh brand panel |
| `images_associated` | `{}` | Project images associated — refresh brand panel |

### Backend: Writing Intents

Tools write intents using the `intentCommand` helper, which bundles a `ToolMessage` and optional `agentIntents` into a single `Command`:

```typescript
// langgraph_app/app/tools/shared/intentCommand.ts
import { intentCommand } from "../shared";
import { brandIntent } from "@types";

return intentCommand({
  toolCallId: config?.toolCall.id,
  toolName: "set_logo",
  content: { success: true, message: "Logo set successfully." },
  intents: [brandIntent("logo_set")],
});
```

The `brandIntent` factory creates brand-specific intents:

```typescript
// shared/types/agentIntent.ts
export const brandIntent = (type: BrandIntentType): BrandAgentIntent => ({
  type,
  payload: {},
  createdAt: new Date().toISOString(),
});
```

The `navigateTool` writes navigate intents directly:

```typescript
// langgraph_app/app/tools/shared/navigate.ts
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
```

### Frontend: Processing Intents

The system uses a class-based processor with a pub/sub pattern:

#### 1. `AgentIntentProcessor` (core engine)

A singleton per chat session that ensures each intent fires to subscribers exactly once (deduped by `createdAt`).

```typescript
// rails_app/.../lib/AgentIntentProcessor.ts
class AgentIntentProcessor {
  on(type: string, handler): () => void;   // Subscribe. Returns unsubscribe.
  process(intents: AgentIntent[]): void;   // Fire new intents to subscribers.
  markProcessed(intents: AgentIntent[]): void; // Revisit guard.
}
```

#### 2. `useAgentIntentSetup` (created in ChatProvider)

Called once per chat. Creates the processor, subscribes to `agentIntents` from graph state via `useChatSelector`, and registers the central `navigate` handler.

```typescript
// rails_app/.../hooks/useAgentIntentSetup.ts
const processor = useAgentIntentSetup(chat);
```

Key behaviors:
- **Revisit guard**: Marks mount-time intents as processed, preventing re-navigation when users go back to a completed page.
- **Processes immediately**: Doesn't wait for streaming to end — intents are replace-semantics so waiting would miss them.
- **Fingerprint dedup**: Skips `process()` calls when the intents array hasn't actually changed (SSE rebuilds the reference on every token).

#### 3. `AgentIntentContext` (React context)

Provides the processor to the component tree. Components subscribe via `subscribeToAgentIntent`:

```typescript
// rails_app/.../context/AgentIntentContext.tsx
subscribeToAgentIntent("social_links_saved", () => {
  queryClient.invalidateQueries({ queryKey: socialLinksKeys.all });
});
```

Brand panel sections use this to refresh their data when the agent modifies brand assets via chat.

## Tools That Emit Intents

| Tool | File | Intent Emitted |
|------|------|----------------|
| `navigateTool` | `tools/shared/navigate.ts` | `navigate` |
| `setLogoTool` | `tools/brand/setLogo.ts` | `logo_set` |
| `changeColorSchemeTool` | `tools/website/changeColorScheme.ts` | `color_scheme_applied` |
| `saveSocialLinksTool` | `tools/brand/saveSocialLinks.ts` | `social_links_saved` |
| `uploadProjectImagesTool` | `tools/brand/uploadProjectImages.ts` | `images_associated` |

## Frontend Subscribers

| Component | Intent | Action |
|-----------|--------|--------|
| `useAgentIntentSetup` | `navigate` | Calls workflow navigate (central handler) |
| `LogoUploadSection` | `logo_set` | Invalidates uploads query |
| `ColorPaletteSection` | `color_scheme_applied` | Invalidates website/theme query |
| `SocialLinksSection` | `social_links_saved` | Invalidates social links query |
| `ProjectImagesSection` | `images_associated` | Invalidates uploads query |

## Adding New Intent Types

1. Add the type to `shared/types/agentIntent.ts`:
   - For brand-related: add to `brandIntentTypes` array
   - For a new category: create a new schema and add to the union

2. Create or update a tool to emit the intent using `intentCommand`:
   ```typescript
   return intentCommand({
     toolCallId,
     toolName: "my_tool",
     content: { success: true },
     intents: [brandIntent("my_new_type")],
   });
   ```

3. Subscribe in the relevant frontend component:
   ```typescript
   subscribeToAgentIntent("my_new_type", () => {
     // Refresh data, show toast, etc.
   });
   ```

## Key Files

| File | Purpose |
|------|---------|
| `shared/types/agentIntent.ts` | Schemas, types, guards, factories |
| `shared/types/graph.ts` | `agentIntents` on `CoreGraphState` |
| `langgraph_app/app/annotation/base.ts` | `agentIntents` annotation (replace reducer) |
| `langgraph_app/app/tools/shared/intentCommand.ts` | Helper to bundle ToolMessage + intents |
| `langgraph_app/app/tools/shared/navigate.ts` | Navigate tool |
| `langgraph_app/app/tools/brand/` | Brand tools (logo, social links, images) |
| `langgraph_app/app/tools/website/changeColorScheme.ts` | Color scheme tool |
| `rails_app/.../lib/AgentIntentProcessor.ts` | Core processor class |
| `rails_app/.../hooks/useAgentIntentSetup.ts` | Processor setup hook |
| `rails_app/.../context/AgentIntentContext.tsx` | React context + `subscribeToAgentIntent` |

## Design Decisions

- **Array with replace semantics** (not append): Each graph turn writes a fresh list. This avoids accumulating stale intents across turns.
- **Tool-based** (not node-based): Intents are written via tools so the LLM decides when to trigger them, matching the conversational flow.
- **`intentCommand` helper**: Reduces boilerplate — bundles ToolMessage and agentIntents into a single Command.
- **`returnDirect: true`** on navigate: Short-circuits the graph since the user is leaving the current page.
- **Class-based processor**: Decouples intent processing from React rendering. The `createdAt`-based dedup set ensures exactly-once delivery regardless of how many times React re-renders.
- **Immediate processing** (not waiting for streaming to end): Intents use replace semantics, so they only exist for one state transition. Waiting would miss them.
- **Revisit guard**: The processor marks mount-time intents as already processed, preventing re-navigation when users go back to a completed page.
