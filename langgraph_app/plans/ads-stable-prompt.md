# Ads Agent: Stable System Prompt + Conversational Turn Context

## Context

The ads agent rebuilds its entire ~11K system prompt every turn via `dynamicPromptMiddleware`. This defeats prompt caching and conflates the agent's identity with per-turn instructions. The fix: a lean, stable system prompt (cached) + one rich conversational context message per turn (in the timeline).

## Design Principles

1. **System prompt is lean** — identity + business context + general behavior (~500-800 tokens). Fully cached.
2. **Context messages are complete task briefings** — asset instructions, char limits, output format, preferences. Everything the agent needs for THIS turn.
3. **Context messages read like conversation**, not technical state dumps — "I liked these headlines. Give me 3 fresh ones."
4. **Preferences only when relevant** — locked/rejected assets appear in the context message for the turn that needs them, not repeated in every turn.
5. **handleIntent = pure state derivation** — no message injection.
6. **Agent builds context + calls LLM** — owns message construction and prompt assembly.
7. **No middleware for system prompt** — `createAgent` accepts `systemPrompt` directly.

## Implementation Steps

### Step 1: Shared Intent Helpers
- Add `switchPage()` and `refreshAssets()` factory functions to `shared/types/intent.ts`

### Step 2: Lean System Prompt
- New file: `app/prompts/ads/systemPrompt.ts`
- ~500-800 tokens: identity, business context, behavior rules
- Same every turn for a given project → fully cached

### Step 3: Conversational Turn Context Builder
- New file: `app/prompts/ads/turnContext.ts`
- Pure function: `(state, config) → BaseMessage | null`
- Returns ONE rich context message per turn, or `null` when user message speaks for itself
- Replaces `userPreferencesPrompt`, `previousAssetsContext`, `contextMessages` injection

### Step 4: handleIntent — Pure State Derivation
- Remove ALL context message injection from `handleIntent.ts`
- Only sets: `stage`, `refresh`, `previousStage`, clears `intent`

### Step 5: Agent — Stable Prompt + Turn Context
- Remove `dynamicPromptMiddleware` from agent
- Pass `systemPrompt` directly to `createAgent`
- Build turn context via `buildTurnContext()` and inject via `Conversation.prepareTurn()`

### Step 6: Remove `userPreferencesPrompt` from Asset Prompts
- Remove `${userPrefs}` from headlines.ts, descriptions.ts, callouts.ts, structuredSnippets.ts, keywords.ts
- Delete `app/prompts/ads/assets/userPreferences.ts`

### Step 7: Clean Up Dead Code
- Remove dead functions from `contextMessages.ts`
- Remove `chooseAdsPrompt` from index
- Remove `promptBuilder` from `assets/main.ts`
- Delete `previousAssetsContext.ts`, `needsIntent.ts`

### Step 8: Unit Tests for New Modules

**File: `tests/tests/prompts/ads/systemPrompt.test.ts`** (NEW)
- Verify `buildSystemPrompt` is deterministic — same brainstorm data → same string every time
- Verify it includes business context fields (idea, audience, solution, socialProof)
- Verify it does NOT include per-turn details (asset instructions, char limits, output formats)

**File: `tests/tests/prompts/ads/turnContext.test.ts`** (NEW)
- **First visit to content stage**: returns context message with page name, asset instructions, output format
- **Refresh assets**: returns context message with preference framing (liked/rejected), refresh request, instructions
- **User message on content stage**: returns `null` (HumanMessage speaks for itself)
- **User message on non-content stage (Q&A)**: returns `null` (HumanMessage speaks for itself)
- **Switch to non-content stage, no user message**: returns minimal page context
- **Preferences included only when present**: locked/rejected assets appear; empty preferences produce no pref section

### Step 9: Update Integration Tests
- Use `switchPage()`, `refreshAssets()` helpers from `shared/types/intent`
- Remove dead "Page Switch Detection" tests (unit tests for removed functions)
- Update integration tests to use intents instead of bare `stage` / `refresh` state

### Step 10: Re-record and Verify
```bash
cd langgraph_app

# Re-record (prompt format changed → old recordings invalid)
POLLY_MODE=record pnpm test tests/tests/graphs/ads/ads.test.ts

# Verify recordings work
pnpm test tests/tests/graphs/ads/ads.test.ts

# Run unit tests for new modules
pnpm test tests/tests/prompts/ads/

# Full type check
pnpm typecheck
```

### Step 11: Manual Verification
- Compare a sample system prompt before/after to confirm it's stable across turns
- Run `bin/dev`, navigate content → highlights → keywords with refreshes and questions
- Verify behavior matches current production

## Files Summary

| File | Action |
|---|---|
| `shared/types/intent.ts` | Add `switchPage()`, `refreshAssets()` |
| `app/prompts/ads/systemPrompt.ts` | **NEW** — lean system prompt |
| `app/prompts/ads/turnContext.ts` | **NEW** — conversational turn context builder |
| `app/prompts/ads/index.ts` | Re-export new modules, remove `chooseAdsPrompt` |
| `app/prompts/ads/contextMessages.ts` | Remove dead functions |
| `app/prompts/ads/assets/main.ts` | Remove `promptBuilder` (replaced) |
| `app/prompts/ads/assets/userPreferences.ts` | **DELETE** |
| `app/prompts/ads/assets/helpers/previousAssetsContext.ts` | **DELETE** |
| `app/prompts/ads/assets/helpers/needsIntent.ts` | **DELETE** |
| `app/prompts/ads/assets/assets/headlines.ts` | Remove `userPrefs` section |
| `app/prompts/ads/assets/assets/descriptions.ts` | Remove `userPrefs` section |
| `app/prompts/ads/assets/assets/callouts.ts` | Remove `userPrefs` section |
| `app/prompts/ads/assets/assets/structuredSnippets.ts` | Remove `userPrefs` section |
| `app/prompts/ads/assets/assets/keywords.ts` | Remove `userPrefs` section |
| `app/nodes/ads/handleIntent.ts` | Simplify to pure state derivation |
| `app/nodes/ads/agent.ts` | Remove middleware, use systemPrompt + turnContext |
| `tests/tests/prompts/ads/systemPrompt.test.ts` | **NEW** — unit tests for system prompt determinism |
| `tests/tests/prompts/ads/turnContext.test.ts` | **NEW** — unit tests for turn context builder |
| `tests/tests/graphs/ads/ads.test.ts` | Use intent helpers, remove dead tests |
| `tests/recordings/ads-agent_*/` | Re-record |
