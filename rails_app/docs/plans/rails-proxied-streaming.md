# Future Infrastructure: Rails-Proxied Streaming Architecture

**Status:** Future milestone (not currently prioritized)
**Goal:** Simplify frontend architecture and add job durability for AI streaming

---

## Current Architecture (Pain Points)

```
Browser ──auth──▶ Rails ──JWT──▶ Browser ──stream──▶ Langgraph
                                    │                    │
                                    ◀────────────────────┘
                                    (if disconnect, job dies)
```

**Problems:**

- Frontend talks to two servers (Rails + Langgraph)
- Authentication happens in two places
- Connection disconnects kill long-running Langgraph jobs (no durability)
- Complex "dance" between architectures

---

## Proposed Architecture: Rails as Dumb Pipe

```
Browser → Rails → Sidekiq → Langgraph worker (TS streaming internally)
                                    │
                                    ▼
                              Redis pub/sub
                                    │
                                    ▼
                     Rails ActionCable (dumb pipe, no parsing)
                                    │
                                    ▼
                              Browser (JS parses)
```

**Key insight:** Rails doesn't need to understand the stream chunks—just relay them. TypeScript abstractions (partial JSON parsing, tool call tracking, state management) stay in Langgraph and the frontend. Rails provides:

1. **Single origin** - No CORS, one auth flow, one API endpoint
2. **Job durability** - Sidekiq jobs complete even if user disconnects
3. **Reconnect & resume** - Results persist, user can reconnect and see them
4. **Langgraph becomes headless** - No public exposure needed

---

## Implementation Approach

### Rails Side

1. **Sidekiq job** to dispatch work to Langgraph:

   ```ruby
   class LanggraphJob < ApplicationJob
     def perform(thread_id, messages, user_id)
       # Call Langgraph worker (internal network, no public exposure)
       # Worker writes chunks to Redis stream
     end
   end
   ```

2. **ActionCable channel** as dumb relay:

   ```ruby
   class ChatChannel < ApplicationCable::Channel
     def subscribed
       stream_from "chat:#{params[:thread_id]}"
     end
   end
   ```

3. **Redis subscriber** (or Langgraph writes directly):
   ```ruby
   # Langgraph worker publishes, ActionCable broadcasts
   ActionCable.server.broadcast("chat:#{thread_id}", raw_chunk)
   ```

### Langgraph Side

- Keep existing `langgraph-ai-sdk` streaming abstractions internally
- Instead of HTTP response, write chunks to Redis pub/sub
- Signal completion with a `{ type: 'done' }` message

### Frontend Side

- Connect to Rails ActionCable instead of Langgraph HTTP stream
- Same parsing logic (chunks arrive the same way, just different transport)
- Add reconnection logic to resume from where stream left off

---

## What We Keep vs. Rebuild

| Component                  | Keep                | Rebuild           |
| -------------------------- | ------------------- | ----------------- |
| langgraph-ai-sdk streaming | ✅ (in Langgraph)   |                   |
| Partial JSON parsing       | ✅ (in frontend JS) |                   |
| Tool call tracking         | ✅ (in frontend JS) |                   |
| State management           | ✅ (in frontend JS) |                   |
| HTTP transport             |                     | ✅ → ActionCable  |
| Direct Langgraph calls     |                     | ✅ → Sidekiq jobs |

---

## Why TypeScript Stays for Streaming

Ruby's streaming primitives are functional but not ergonomic:

- `ActionController::Live` blocks a thread per connection
- No native async/await (Fibers exist but aren't widely adopted)
- Partial JSON parsing libraries are scarce
- Ecosystem assumes request/response, not streaming

TypeScript excels here:

- `ReadableStream` / `TransformStream` are native
- `async generators` with `for await...of` are ergonomic
- Vercel `ai` SDK, `partial-json-parser` are battle-tested
- Ecosystem assumes streaming

**The hybrid makes sense:** TypeScript handles streaming-heavy parts, Rails handles CRUD/auth/business-logic.

---

## Benefits Summary

1. **Job durability** - User closes laptop, job finishes, results waiting
2. **Simpler frontend** - One API, one auth, one connection
3. **Better security** - Langgraph not publicly exposed
4. **Unified observability** - All requests flow through Rails
5. **Testability** - Server-to-server coordination is more controllable than browser-to-multiple-servers

---

## When to Revisit

Consider prioritizing when:

- Connection drops become a frequent user complaint
- Multi-step AI workflows need to survive disconnects
- Security audit flags dual-server auth complexity
- Scaling concerns make single-origin simpler to manage
