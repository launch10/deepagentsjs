# Plan: Defer Website Chat/Thread Creation to Graph Execution

## Context

The website Chat record (and its `thread_id`) is currently pre-created during brainstorm creation via the `ChatCreatable` concern's `after_create` hook. This means when a user first navigates to the website page, `thread_id` already exists as a page prop. The Langgraph SDK interprets this as "existing thread → load history" rather than "new thread → create flow with streaming."

This causes several problems:
- No streaming "first generation" experience (no chat loading spinner, no streamed messages)
- CACHE_MODE can't properly simulate the real frontend flow
- The `website_generated` test snapshot loads files from history instead of streaming them
- Diverges from the SDK's canonical pattern (brainstorm already follows the correct pattern)

**Goal:** Remove pre-created Chat from Website. Create the Chat during graph execution via an `updateWebsite` node (mirroring brainstorm's `createBrainstorm` node). This aligns with SDK expectations and gives users the full streaming experience on first website generation.

## Changes

### 1. Remove `ChatCreatable` from Website model

**File:** `rails_app/app/models/website.rb`

- Remove `include ChatCreatable`
- Keep `has_one :chat, as: :contextable, dependent: :destroy` (add directly)
- Add a `create_website_chat!(thread_id:)` method for explicit chat creation

### 2. Add Rails API endpoint for website chat initialization

**File:** `rails_app/app/controllers/api/v1/websites_controller.rb`

- Add `initialize_chat` action: `POST /api/v1/websites/:id/initialize_chat`
- Accepts `{ thread_id }` in body
- Creates Chat record for the website (idempotent - returns existing if present)
- Returns `{ chat_id, thread_id }`
- Add route in `config/routes.rb`

### 3. Create `updateWebsite` node in Langgraph

**Files:**
- `langgraph_app/app/nodes/website/updateWebsite.ts` (new)
- `langgraph_app/app/services/api/websiteAPIService.ts` (add method)

Following the `createBrainstorm` pattern (`langgraph_app/app/nodes/core/createBrainstorm.ts`):
- Check if `chatId` already exists in state (idempotent - return early)
- Call `WebsiteAPIService.initializeChat(websiteId, threadId)`
- Return `{ chatId }` to state

### 4. Add `updateWebsite` node to website graph

**File:** `langgraph_app/app/graphs/website.ts`

- Add `updateWebsite` as the first node in `websiteBuilderSubgraph` (before `buildContext`)
- Edge: `START → updateWebsite → buildContext → ...`
- Also add it as first node in other subgraphs (theme handler, improve copy) so chat is always created regardless of intent

### 5. Add `onThreadIdAvailable` to website chat hook

**File:** `rails_app/app/javascript/frontend/hooks/website/useWebsiteChat.ts`

- Pass `onThreadIdAvailable` callback to `useChatOptions`
- Callback does `router.push()` to update Inertia page props with new `thread_id` (like brainstorm's pattern in `useBrainstormChat.ts:44-79`)
- URL stays the same (`/projects/:uuid/website/build`), just props update

### 6. Verify `useWebsiteInit` works with undefined `thread_id`

**File:** `rails_app/app/javascript/frontend/components/website/steps/BuildStep.tsx`

- Already handles this: when `thread_id` is undefined, `hasInitialized.current = false`, so `updateState()` fires
- The `updateState({ websiteId, projectId })` triggers POST → graph runs → streaming experience
- No changes needed here, just verify

### 7. Update `project.current_chat` to handle missing website chat

**File:** `rails_app/app/models/concerns/project_concerns/serialization.rb`

- `core_json` already uses safe navigation: `project.current_chat&.thread_id`
- Verify `current_chat` returns nil gracefully when website has no Chat yet
- Check `current_chat` implementation to confirm

### 8. Update snapshot builders

**File:** `rails_app/spec/snapshot_builders/website_step.rb`
- No Chat is auto-created for Website anymore (which is correct - this represents pre-generation state)
- Verify brainstorm Chat is unaffected (brainstorm creates its own Chat via `createBrainstorm` node)

**File:** `rails_app/spec/snapshot_builders/website_generated.rb`
- Manually create the website Chat record (simulating what `updateWebsite` node would do)
- Use a known thread_id for the checkpoint seeding

### 9. Update CACHE_MODE flow

**No changes needed** - CACHE_MODE already works within the graph execution pipeline. With the new flow:
1. No `thread_id` → SDK creates new chat → POST to stream
2. `updateWebsite` node creates Chat in Rails
3. `isCacheModeEnabled(state)` returns `true` (no messages)
4. `websiteBuilder` returns cached files
5. Files stream to frontend naturally

### 10. (Follow-up) Consider removing `ChatCreatable` from Campaign + Deploy

Same pattern can be applied to Campaign and Deploy models, having their respective graphs create Chats explicitly. Not in scope for this PR but noted as follow-up.

## Verification

1. **Manual test (dev mode with CACHE_MODE=true):**
   - Navigate to website page for first time after brainstorm
   - Should see: chat loading spinner → streaming message → files loading → preview
   - Refresh page → should load from history (no re-generation)

2. **Manual test (dev mode without CACHE_MODE):**
   - Same flow but with real AI generation
   - Verify chat and files are created, thread persists on reload

3. **Rebuild snapshots:**
   - `bundle exec rake snapshots:build[website_step]`
   - `bundle exec rake snapshots:build[website_generated]`

4. **Run existing e2e tests** to catch regressions:
   - `pnpm test:e2e` (any website-related tests)

5. **Run Rails specs:**
   - `bundle exec rspec spec/models/website_spec.rb`
   - `bundle exec rspec spec/models/chat_spec.rb`
