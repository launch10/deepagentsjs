# Streaming Infrastructure & Agent-to-User Communication

This document captures everything we know about how streaming, agent messaging, and real-time feedback work in our stack. The goal: make informed decisions about showing users what agents are doing, in real time, using clean reusable patterns.

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [Backend Streaming Pipeline (LangGraph → HTTP)](#2-backend-streaming-pipeline)
3. [Frontend: Two Paths to the Same Server](#3-frontend-two-paths)
4. [How Agents Produce User-Facing Messages Today](#4-how-agents-produce-messages)
5. [Existing Infrastructure We Already Have](#5-existing-infrastructure)
6. [The Frontend Loading Problem](#6-the-frontend-loading-problem)
7. [Industry Patterns (Claude Code, Vercel AI SDK, Cursor)](#7-industry-patterns)
8. [Research Findings: What the Community Actually Does](#8-research-findings)
9. [Decisions (Informed by Research)](#9-decisions)

---

## 1. The Problem

When a user finishes brainstorm and clicks "continue", the website builder graph runs but:

- No AI greeting message appears
- No streamed tokens visible during generation
- No todo progress updates
- User sees a spinner with fake loading steps for ~30-60 seconds
- Eventually files appear and the preview shows

**Expected UX**: Land on page → immediate AI message ("I'm building your landing page based on your brainstorm about X...") → real todos updating as work progresses → streamed tokens → files arrive → preview shows.

The streaming infrastructure actually works. The problem is a combination of: (a) the frontend hides the chat behind a loading spinner, (b) `runStateOnly` only handles a subset of chunk types, and (c) the agent doesn't produce an early user-facing message before starting heavy work.

---

## 2. Backend Streaming Pipeline

### 2.1 LangGraph → Stream Handlers → HTTP Response

**File:** `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk/src/stream.ts`

The graph streams via `streamEvents` with multiple modes enabled (line 675-680):

```typescript
const stream = graph.streamEvents(graphState, {
  version: "v2",
  streamMode: ["messages", "updates", "custom"],
  subgraphs: true,
  configurable: { thread_id: threadId },
});
```

`adaptStreamEvents()` (line 634-667) transforms raw LangGraph events into typed `StreamChunk` tuples, which are dispatched by the `Handlers.handle()` method (line 604-619):

| Stream mode    | Handler                                 | What it emits                                                                                                        | Line                      |
| -------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `messages`     | `RawMessageHandler` + `ToolCallHandler` | `data-content-block-text`, `data-content-block-reasoning`, `data-content-block-structured`, `data-state-streaming-*` | 214-350                   |
| `updates`      | `StateHandler`                          | `data-state-{key}` for each state key (skips `messages`)                                                             | 445-452, inherits 414-442 |
| `custom`       | `CustomHandler`                         | `data-custom-{eventName}`                                                                                            | 534-554                   |
| `on_chain_end` | `FinalStateHandler`                     | `data-state-final-{key}` + catches unstreamed messages as `data-content-block-text`                                  | 454-531                   |
| `events`       | `EventsHandler`                         | Tool lifecycle events (on_tool_end, on_tool_error)                                                                   | 556-578                   |

### 2.2 RawMessageHandler: The `tags: ["notify"]` Gate

The critical filter (line 253-255):

```typescript
const notify = metadata.tags?.includes("notify");
if (!notify) return;
```

Only LLM calls tagged with `["notify"]` get their tokens streamed to the frontend. This is how we distinguish user-facing output from internal agent chatter. In the coding agent, the main LLM is tagged (agent.ts line 129-131):

```typescript
const llm = (await getLLM({ skill: "coding", speed: "slow", cost: "paid" })).withConfig({
  tags: ["notify"],
});
```

### 2.3 StateHandler: Skips `messages`, Emits Everything Else

Line 424: `if (key === 'messages') return;`

This is by design. LLM messages are handled by `RawMessageHandler` via token streaming. All other state keys (files, todos, status, etc.) are emitted as `data-state-{key}` chunks when their node completes.

### 2.4 FinalStateHandler: Catches Unstreamed Messages

Lines 492-527: When `rawMessageHandler.hasEmittedMessageContent === false`, the final state handler emits message content as `data-content-block-text` chunks. This handles cases where:

- Cache mode returns pre-built messages (no LLM streaming)
- The agent produces messages without an LLM call

It checks for `parsed_blocks` in `response_metadata` (from `toStructuredMessage`) first, falling back to raw `msg.content`.

### 2.5 CustomHandler: `config.writer` → `data-custom-*`

Line 534-554: Transforms `config.writer()` calls into `data-custom-{eventName}` chunks:

```typescript
// In a node:
config.writer({ id: uuidv7(), event: "NOTIFY_TASK_START", task: { title: "Building website" } });
// Becomes SSE chunk:
// type: "data-custom-notify-task-start", id: "...", data: { task: { title: "Building website" } }
```

### 2.6 The Server Route: No Difference Between stateOnly and Message Requests

**File:** `langgraph_app/app/server/routes/website.ts`

Both `sendMessage` and `runStateOnly` hit the same `POST /stream` endpoint. The server does NOT read or act on the `stateOnly` flag. It just runs the graph with whatever messages + state it receives. The only difference is client-side.

---

## 3. Frontend: Two Paths to the Same Server

**File:** `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/langgraphChat.ts`

### 3.1 `sendLanggraphMessage` (line 419-531)

Used for: **User sends a chat message** (edit flow).

Delegates to Vercel AI SDK's `Chat.sendMessage()`. The AI SDK transport handles ALL chunk types automatically — text blocks, state updates, tool calls, custom events — because it's wired into the full `createUIMessageStream` / `createUIMessageStreamResponse` pipeline.

### 3.2 `runStateOnly` (line 533-634)

Used for: **System-initiated runs** where no user message is sent (e.g. create flow auto-init from `useWebsiteInit`).

Does its own `fetch()` + SSE parsing. Currently handles only two chunk types (line 597-617):

```typescript
if (chunk.type.startsWith("data-state")) {
  this.#stateManager.processStatePart(chunk as DataPart);
} else if (chunk.type.startsWith("data-content-block-text")) {
  // Create/update assistant message
}
```

**What `runStateOnly` DOES handle:**

- `data-state-*` → StateManager → React state callbacks (todos, files, status all work)
- `data-content-block-text` → Creates/updates an assistant message in the UI

**What `runStateOnly` does NOT handle:**

- `data-content-block-reasoning` → Extended thinking blocks are dropped
- `data-custom-*` → Custom events (including notification events) are dropped
- Tool call lifecycle events → Dropped
- `data-message-metadata` → Dropped

### 3.3 How `runStateOnly` is Invoked

**File:** `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/chatSnapshot.ts` (line 66-68)

```typescript
updateState: (state: Partial<TState>) => {
  chat.runStateOnly({ additionalState: state });
},
```

**File:** `rails_app/.../steps/BuildStep.tsx` — `useWebsiteInit` hook calls `updateState({ websiteId, projectId })` on first load, triggering `runStateOnly`.

---

## 4. How Agents Produce User-Facing Messages Today

### 4.1 Full Coding Agent (deepagents)

**File:** `langgraph_app/app/nodes/coding/agent.ts`

The full agent is a multi-turn ReAct loop (deepagents). During execution:

- LLM tokens stream in real-time via `tags: ["notify"]` → `RawMessageHandler` → `data-content-block-text`
- Tool calls happen internally (file reads, writes, searches)
- The agent produces many AI messages during its loop

After execution (line 328-343):

- Only `firstAI` and `lastAI` messages are kept for the user
- `stripToolArtifacts()` removes tool_use/tool_call blocks from these messages
- `toStructuredMessage()` converts them for frontend rendering

**The key insight**: During the agent's execution, tokens ARE streaming to the frontend in real time. But after completion, only a cleaned-up first + last message are persisted to graph state.

### 4.2 Single-Shot Edit

**File:** `langgraph_app/app/nodes/coding/singleShotEdit.ts`

One LLM call with native `text_editor` tool. The LLM is also tagged `["notify"]`, so tokens stream. But:

- It's a single call — there's no opportunity for "tell then do" (plan → execute)
- The LLM generates tool input (file edits) as its response, not user-facing text
- A separate user-facing message is constructed after completion from the text content

### 4.3 How Messages Get to the Frontend

**During streaming (real-time):**

1. LLM generates tokens → `messages` stream mode
2. `RawMessageHandler` checks for `tags: ["notify"]` → emits `data-content-block-text`
3. Frontend receives chunks and builds assistant message parts

**At graph end (batch):**

1. Node returns `{ messages: [...], files: {...}, todos: [...] }`
2. `StateHandler` emits `data-state-files`, `data-state-todos` (skips messages)
3. `FinalStateHandler` emits `data-state-final-*` for all keys
4. If no tokens were streamed, `FinalStateHandler` emits message content as `data-content-block-text`

---

## 5. Existing Infrastructure We Already Have

### 5.1 `config.writer` + CustomHandler

**Already working.** Any node or tool can call `config.writer({ event: "my-event", id: "...", ...data })` and it becomes a `data-custom-my-event` SSE chunk. The pipeline is: node → `config.writer()` → `custom` stream mode → `CustomHandler` (stream.ts:534) → `data-custom-{eventName}` chunk → HTTP response.

### 5.2 `withNotifications` Middleware

**File:** `langgraph_app/app/core/node/middleware/withNotifications.ts`

Already wraps nodes via `NodeMiddleware.use()`. Emits three events:

- `NOTIFY_TASK_START` — when a node begins
- `NOTIFY_TASK_COMPLETE` — when a node finishes
- `NOTIFY_TASK_ERROR` — when a node throws

These become `data-custom-notify-task-start`, `data-custom-notify-task-complete`, `data-custom-notify-task-error` in the stream.

**Problem:** The frontend doesn't consume these events. No matches for `notify-task` in the Rails JS codebase. The events are emitted into the void.

### 5.3 `DerivedDataCache.extractEvents()`

**File:** `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/DerivedDataCache.ts` (line 209-229)

Already extracts `data-custom-*` parts from the latest assistant message's parts array and exposes them as `CustomEvent[]`. This means if custom events were stored in message parts, the UI could already access them.

**But:** This only works for events that end up in message parts (via `sendMessage` path). In `runStateOnly`, custom events are never captured because that code doesn't handle `data-custom-*` chunks.

### 5.4 `StateManager` and Per-Key Callbacks

**File:** `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/StateManager.ts`

Processes `data-state-*`, `data-state-streaming-*`, and `data-state-final-*` chunks. Calls per-key callbacks that React hooks subscribe to via `useWebsiteChatState(key)`.

**This already works correctly** for `runStateOnly`. When the websiteBuilder node completes, `data-state-todos` and `data-state-files` arrive and React IS notified. The problem is the loading UI hides the chat where these would be visible.

### 5.5 `toStructuredMessage` + `parsed_blocks`

Converts `AIMessage` content into structured blocks stored in `response_metadata.parsed_blocks`. The `FinalStateHandler` uses these to emit `data-content-block-text` for unstreamed messages. This is how cache-mode messages and agent summary messages get to the frontend without LLM streaming.

---

## 6. The Frontend Loading Problem

### 6.1 `isInitialLoading` Hides Everything

**File:** `rails_app/.../steps/BuildStep.tsx` (line 89)

```typescript
const isInitialLoading = isLoadingHistory || (isStreaming && !hasFiles && !hasTodos);
```

During the create flow:

1. `useWebsiteInit` calls `updateState()` → `isStreaming` becomes true
2. `hasFiles` is false (no files yet), `hasTodos` is false (no todos yet)
3. Therefore `isInitialLoading` is true
4. The sidebar shows `WebsiteSidebarLoading` (fake loading steps)
5. The preview shows `WebsiteLoader` (spinner)
6. **The chat component is completely hidden**

All streamed content (tokens, todos, files) accumulates behind the spinner and only becomes visible when `isInitialLoading` flips to false (when files or todos arrive).

### 6.2 `WebsiteSidebarLoading`: Fake Steps

**File:** `rails_app/.../sidebar/loading/WebsiteSidebarLoading.tsx`

Shows 7 hardcoded fake steps:

1. Analyzing your ideas
2. Setting up branding & color
3. Writing compelling copy
4. Designing hero section
5. Adding additional sections
6. Selecting the perfect images
7. Polishing site with final touches

These are static and decorative. They don't reflect real agent progress.

### 6.3 Real Todos: `TodoList` Component

**File:** `rails_app/.../shared/chat/TodoList.tsx`

Renders real agent todos with `pending`/`in_progress`/`completed` statuses. Uses smaller, inline styling compared to `LoadingStepPill`. Todos arrive when the websiteBuilder node completes (as `data-state-todos`), which is at the END of the agent's work — not incrementally during.

---

## 7. Industry Patterns

_(Full research document at `.claude/plans/sequential-imagining-yeti-agent-abacc57.md`)_

### 7.1 The "Tell Then Do" Pattern

Every best-in-class agent tool follows:

```
1. PLAN    — Agent describes what it will do
2. STREAM  — Agent executes, streaming progress
3. VERIFY  — Agent confirms results
4. PRESENT — Agent summarizes what was done
```

**Claude Code**: Spinner with embedded todo items (togglable via Ctrl+T). Each tool call is a discrete renderable block. Permission prompts as natural checkpoints.

**Cursor/Windsurf**: Plan display before execution → file-level progress → inline diffs → terminal output in real-time.

**Vercel AI SDK**: Typed message parts (`text`, `tool-call`, `data-*`). Tool lifecycle states (`input-streaming` → `input-available` → `output-available`). Regular vs. transient data parts (persistent artifacts vs. ephemeral progress).

### 7.2 Key Design Principle: The Agent Should Naturally Produce User-Facing Messages

The best agents don't use hardcoded greetings or custom events for status messages. Instead:

- The system prompt instructs the agent to explain what it's about to do
- The agent's first response IS the plan/greeting (e.g. "I'll build your landing page with a hero section featuring X, testimonials about Y...")
- Tokens stream in real time as the agent writes this explanation
- THEN the agent calls tools to execute

This means the "greeting" is just the LLM's natural first response, streaming in real time. No custom events needed.

### 7.3 Transient vs. Persistent Data

Vercel AI SDK distinguishes:

- **Regular data parts**: Persist in message history (generated files, search results)
- **Transient data parts**: Fire-and-forget progress updates (step counters, "thinking about X")

This maps to our infrastructure as:

- **State updates** (`data-state-*`): Persist (files, todos)
- **Custom events** (`data-custom-*`): Could be transient (progress, node start/complete)

---

## 8. Research Findings: What the Community Actually Does

We researched how Vercel AI SDK (v5/v6), LangGraph, AG-UI, OpenAI Agents SDK, Claude Code, and Cursor handle each of the patterns we identified as potentially hacky. The findings are clear — some of our patterns are fine, some need to change.

### Pattern 1: `tags: ["notify"]` — Verdict: Partly Right, Needs Refinement

**What the community does:**

Every framework uses a **typed, parts-based message model** where each piece of content has a semantic type, and the frontend decides what to render based on that type. The three layers of control are:

1. **Server-side gating** — what enters the stream at all (Vercel: `sendReasoning: false`; LangGraph: stream mode selection; Claude Code: `isMeta: true`)
2. **Protocol-level typing** — semantic categorization (Vercel: `part.type`; AG-UI: 19 typed `EventType` values; Claude Code: `content_block.type`)
3. **Frontend rendering decisions** — the frontend switch-cases on type and renders accordingly

**Surprise finding:** LangGraph's own documentation recommends tag-based filtering on the `messages` stream mode as the standard pattern for controlling which LLM tokens reach the user. The tag approach is not anti-pattern — but there's a crucial difference: **the filtering happens at the consumer, not the producer**. All tokens stream; the consumer decides which to display.

**What's actually wrong with our approach:**

- Our `RawMessageHandler` filters at the **producer** (server-side) — it drops untagged tokens entirely, so the consumer never has the option to see them
- The tag has no semantic meaning — it says "stream this" but doesn't say "this is text" vs "this is a tool call" vs "this is reasoning"
- For multi-turn agents, tagging the LLM instance means all-or-nothing for everything that LLM produces

**Recommended change:** Move toward typed parts. In the near term, keep `tags: ["notify"]` for backwards compatibility but plan to emit typed chunks (text, tool-call, reasoning) that the frontend can individually control. This aligns with where Vercel AI SDK v6's `createAgentUIStreamResponse` is heading.

### Pattern 2: "First and Last AI Message" — Verdict: Definitively Wrong

**What the community does:**

Every framework stores the complete message history. The consensus is a three-layer separation:

| Layer           | Purpose                     | Who Decides                              |
| --------------- | --------------------------- | ---------------------------------------- |
| **Storage**     | Keep everything             | Always: persist all messages             |
| **Display**     | What the user sees          | Frontend: render selectively             |
| **LLM Context** | What gets sent to the model | Backend: trim/summarize for token budget |

Specific examples:

- **Vercel AI SDK**: Persist full `UIMessage[]` in `onFinish`. Multi-step agents accumulate ALL intermediate steps into a single assistant UIMessage's `parts` array.
- **LangGraph**: Append-only `messages` state, checkpointed at every node. `RemoveMessage` is an explicit, opt-in operation.
- **OpenAI**: All items (messages, tool calls, outputs) stored as first-class objects.
- **Claude Code**: Complete JSONL with every `tool_use` and `tool_result`. Context compaction for LLM is separate from disk persistence.
- **Anthropic API**: The Messages API requires tool_use/tool_result pairs to be present in history. Stripping them breaks conversation continuity.

**What we should do:** Store all messages from the agent loop. Let the frontend decide rendering (collapsed summary with expandable detail). Trim separately for LLM context (clear old tool results, summarize long conversations). The Vercel "single UIMessage with parts array" pattern is especially relevant — the agent's multi-step execution becomes one message with many parts, not 20 separate messages.

### Pattern 3: No Explicit Communication Channel — Verdict: Current Approach is Correct

**What the community does:**

The LLM's natural text output IS the primary agent-to-user communication channel. **No major framework uses a `sendMessageToUser` tool.** This is not accidental:

- LLMs are trained so text output = user-facing message
- Adding a communication tool creates semantic confusion about what normal text output means
- The "tell then do" pattern (agent explains before acting) emerges from **system prompt instructions**, not framework features
- Claude Code, Cursor, Devin all use the same approach: text output = voice, tool calls = actions, structured events = progress

**For out-of-band communication** (progress updates, status messages that aren't the LLM's voice):

- Vercel: Typed data parts (`writer.write({ type: 'data-status', data: {...} })`)
- LangGraph: `config.writer()` via custom stream mode
- AG-UI: Lifecycle events (`STEP_STARTED`, `STEP_FINISHED`)
- Claude Code: Task system (`TodoWrite` / `TaskUpdate`)

**What we should do:** Keep the LLM's text output as the communication channel. Use system prompt instructions for "tell then do." Use `config.writer()` for out-of-band progress signals. Do NOT build a `sendMessageToUser` tool.

### Pattern 4: Two Streaming Paths — Verdict: Bring to Parity Now, Unify Later

**What the community does:**

**No framework has multiple streaming consumption paths.** Every one uses a single unified transport:

| Framework     | Approach                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------ |
| Vercel AI SDK | Single `ChatTransport.sendMessages()`. `trigger` field distinguishes submit vs regenerate. |
| AG-UI         | Single event stream with 23+ event types. State and message events share one channel.      |
| LangGraph     | Single `runs.stream()` endpoint. All input is state.                                       |

**Key finding:** The Vercel AI SDK's `sendMessage()` can be called **with no arguments** — it resubmits existing messages without adding a new user message. Combined with the `body` option for passing additional state, this could eventually replace `runStateOnly`.

**Risk for unification now:** `updateState` (which calls `runStateOnly`) is used in many places. Migrating all call sites to `sendMessage(undefined, { body })` is non-trivial. There's also an [open issue (#8247)](https://github.com/vercel/ai/issues/8247) where `sendMessage()` from `useEffect` doesn't properly stream.

**What we should do now:** Keep `runStateOnly` but bring it to parity — add handlers for all chunk types (`data-custom-*`, `data-content-block-reasoning`, tool lifecycle events, `data-message-metadata`). This closes the "perpetually behind" gap immediately. Unifying into a single transport is a future improvement once the existing usage is stable.

### Pattern 5: Custom Events Into the Void — Verdict: Right Mechanism, Missing Consumer

**What the community does:**

`config.writer()` IS the correct LangGraph mechanism for progress events. The missing piece is frontend consumption.

**How other frameworks handle progress:**

| Framework     | Ephemeral Progress                                                | Persistent Progress                            |
| ------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| Vercel AI SDK | `writer.write({ ..., transient: true })` → `onData` callback only | `writer.write({ id, data })` → `message.parts` |
| LangGraph     | `config.writer()` → `onCustomEvent` in `useStream` hook           | Graph state updates → checkpoint               |
| AG-UI         | `STEP_STARTED/FINISHED` lifecycle events                          | `STATE_DELTA` / `STATE_SNAPSHOT`               |
| Claude Code   | Spinner with active task                                          | `TaskUpdate` persisted to `~/.claude/tasks/`   |

The consensus pattern: **progress events live in a separate channel from the message stream.** They reach the UI for real-time display but don't persist in conversation history. The frontend maintains ephemeral local state (React useState) for progress indicators, populated from the side channel and cleared when the operation completes.

**What we should do:**

1. Keep `config.writer()` for emission (correct)
2. Keep `withNotifications` middleware (correct pattern)
3. Add frontend event handling — intercept `data-custom-*` chunks and dispatch to React state
4. Use transient events for progress (spinners, "currently doing X") — discard when done
5. Use graph state for persistent progress (todo lists) if we want them in conversation history

---

## 9. Decisions (Informed by Research)

Research answered several questions definitively. The remaining decisions are about implementation approach.

### Resolved: Q1 — Research First vs Ship Now

**Answer: Research is done.** The findings validate some patterns and invalidate others. We can now make informed changes.

### Resolved: Q2 — Bring `runStateOnly` to Parity

**Answer: Keep `runStateOnly` but bring it to parity with `sendMessage`.** There are many places that use `updateState` to push state without a user message — this is a legitimate use case that `sendMessage(undefined)` doesn't cleanly replace today. The research ideal of a single unified path is a future goal, not an immediate change.

**What to do now:** Add handlers for all chunk types to `runStateOnly` so it handles `data-custom-*`, `data-content-block-reasoning`, tool lifecycle events, and `data-message-metadata` — the same set that `sendMessage` handles via the AI SDK transport. This closes the "perpetually behind" gap without requiring a migration of all `updateState` call sites.

### Resolved: Q3 — Agent Communication Pattern

**Answer: LLM text output IS the communication channel.** System prompt instructs the agent to explain before acting. `config.writer()` for out-of-band progress. No `sendMessageToUser` tool.

### Resolved: Q7 — Message Persistence

**Answer: Store all messages.** Three-layer separation:

1. **Storage**: Keep everything (all messages, tool calls, tool results)
2. **Display**: Frontend renders selectively (collapsed tool calls, expandable detail)
3. **LLM Context**: Trim/summarize old tool results when sending to model

Consider adopting the Vercel "single UIMessage with parts array" pattern — the agent's multi-step execution becomes one message with typed parts.

### Resolved: Q8 — Chunk Types for `runStateOnly`

**Answer: Bring to parity.** Since we're keeping `runStateOnly`, add handlers for:

- `data-custom-*` (notification events already being emitted — this is the critical gap)
- `data-content-block-reasoning` (extended thinking)
- Tool lifecycle events
- `data-message-metadata`

This is the direct implementation work from Q2.

### Still Open: Q4 — Loading Experience During Create Flow

**Context**: The `isInitialLoading` gate hides everything behind a fake loading spinner. Research confirms we should show real agent output.

**Recommended: Option B — Show real chat + progress indicator for preview**

- Remove the loading gate for the sidebar. Show chat immediately.
- The agent's first streamed tokens (via "tell then do" system prompt) provide the greeting.
- Preview area shows a loader until files arrive (this is still a real wait).
- Todos/state arrive incrementally via the unified stream.

### Still Open: Q5 — How to Show Progress

**Context**: Research shows two viable patterns:

**Option A: Transient custom events (ephemeral progress)**

- `config.writer()` emits `{ type: 'step_started', step: 'generating_layout' }` from within the agent
- Frontend shows these as real-time status ("Generating layout...")
- Events are transient — not persisted in conversation history
- Matches Vercel's transient data parts and AG-UI's lifecycle events

**Option B: Persistent todo state (plan = progress)**

- Agent creates plan as structured tasks in graph state
- As nodes execute, tasks transition `pending → in_progress → completed`
- Frontend renders task list (like our existing `TodoList` component)
- Tasks persist in conversation history — visible on reload
- Matches Claude Code's task system

**Option C: Hybrid**

- Agent's streamed text is the primary progress indicator (real-time)
- Todo state provides a persistent, structured checklist alongside
- Transient custom events supplement for node-level progress

**Recommendation:** Start with the agent's streamed text as primary progress (via "tell then do" system prompt — zero infrastructure work). Add transient custom events as a follow-up if we want more granular status indicators. Keep persistent todos for the edit flow where they serve as a checklist of changes.

### Still Open: Q6 — Single-Shot Edit Greeting

**Context**: Single-shot is ~2-3 seconds. No opportunity for "tell then do" within one LLM call.

**Recommended: Option B — Transient synthetic message**

- Emit a brief transient progress event via `config.writer()` before the LLM call: `{ type: 'status', message: 'Making that change...' }`
- Displayed as ephemeral UI, not persisted
- Minimal code change, polished UX
- Once `runStateOnly` handles `data-custom-*` chunks (Q2/Q8), this works on both streaming paths

---

## File Reference

| File                                                              | What It Does                                                               |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/langgraph-ai-sdk/.../stream.ts`                         | All stream handlers (RawMessage, State, FinalState, Custom, Events)        |
| `packages/langgraph-ai-sdk-react/.../langgraphChat.ts`            | `sendLanggraphMessage` (line 419) and `runStateOnly` (line 533)            |
| `packages/langgraph-ai-sdk-react/.../StateManager.ts`             | Processes `data-state-*` chunks, per-key React callbacks                   |
| `packages/langgraph-ai-sdk-react/.../DerivedDataCache.ts`         | `extractEvents()` (line 209) — extracts `data-custom-*` from message parts |
| `packages/langgraph-ai-sdk-react/.../chatSnapshot.ts`             | `updateState` → `runStateOnly` (line 66)                                   |
| `langgraph_app/.../website/websiteBuilder.ts`                     | Main website builder node, wraps `createCodingAgent`                       |
| `langgraph_app/.../coding/agent.ts`                               | `createCodingAgent` — routes to single-shot or full agent                  |
| `langgraph_app/.../coding/singleShotEdit.ts`                      | One-shot LLM call with text_editor tool                                    |
| `langgraph_app/.../coding/messageUtils.ts`                        | `stripToolArtifacts`, `sanitizeMessagesForLLM`                             |
| `langgraph_app/.../core/node/middleware/withNotifications.ts`     | Emits NOTIFY_TASK_START/COMPLETE/ERROR via `config.writer`                 |
| `langgraph_app/.../server/routes/website.ts`                      | POST /stream — same handler for both paths                                 |
| `rails_app/.../steps/BuildStep.tsx`                               | `isInitialLoading` logic, `useWebsiteInit` auto-start                      |
| `rails_app/.../sidebar/loading/WebsiteSidebarLoading.tsx`         | 7 fake loading steps                                                       |
| `rails_app/.../sidebar/loading/WebsiteSidebarLoadingStepPill.tsx` | Loading step pill UI component                                             |
| `rails_app/.../shared/chat/TodoList.tsx`                          | Real inline todos in chat                                                  |

## External Research

### Research Agent Reports (February 2026)

Five parallel research agents investigated community best practices:

1. **Output Visibility Patterns** — How Vercel AI SDK, LangGraph, AG-UI, Claude Code, and Cursor control which agent output users see. Findings: typed parts-based model, three layers of control (server gating, protocol typing, frontend rendering).

2. **Message Persistence** — How frameworks handle multi-turn agent message storage. Findings: store everything, render selectively, trim for LLM separately. "First and last" is definitively wrong.

3. **Agent-to-User Communication** — Whether `sendMessageToUser` is a real pattern. Findings: LLM text output IS the channel. No framework uses a communication tool. "Tell then do" emerges from prompting.

4. **Unified vs Dual Streaming** — Whether `runStateOnly` should exist. Findings: No framework has dual paths, but `runStateOnly` serves a real need (`updateState` is used in many places). Decision: keep it but bring to parity with all chunk types.

5. **Progress Event Patterns** — How frameworks handle real-time progress. Findings: `config.writer()` is correct LangGraph mechanism. Transient vs persistent distinction is key. Frontend consumption is the missing piece.

Full agent outputs are in the task output files for this session.

### Prior Research

Initial best-in-class research (Claude Code, Vercel AI SDK, LangGraph, Cursor, AG-UI) is at:
`.claude/plans/sequential-imagining-yeti-agent-abacc57.md`
