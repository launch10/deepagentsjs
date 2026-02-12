/**
 * Context Leakage — verifies that context messages injected by prepareTurn
 * stay with their original turn and do NOT float to subsequent turns.
 *
 * Reproduces the bug where:
 * 1. Turn N: prepareTurn injects [Build Errors] context before the user message
 * 2. Agent processes and returns ALL messages (input + response)
 * 3. Reducer deduplicates by ID — existing messages keep their positions,
 *    new messages (context) get appended to the end → context jumps BEHIND
 *    the human message it was supposed to precede
 * 4. Turn N+1: Conversation.parse() attaches the misplaced context to the NEXT turn
 * 5. The agent sees stale build errors and tries to fix them again
 *
 * The fix: reconcileForReducer() emits RemoveMessage entries for existing
 * messages that appear after new messages in the agent output. The reducer
 * removes them first, then re-adds them in the correct position.
 */
import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { createContextMessage, isContextMessage } from "langgraph-ai-sdk";
import { timestampedMessagesReducer } from "@annotation";
import { Conversation } from "@conversation";

/**
 * Simulates the agent returning ALL messages (input + new responses).
 * This mirrors what deepagents' agent.invoke() returns — the full state.
 */
function simulateAgentOutput(
  inputMessages: BaseMessage[],
  agentResponses: BaseMessage[]
): BaseMessage[] {
  return [...inputMessages, ...agentResponses];
}

/**
 * Simulates the node returning agent output through the graph reducer.
 * timestampedMessagesReducer now handles ordering reconciliation internally:
 * when new messages appear before existing ones, it removes the existing ones
 * first so they get re-added in the correct position.
 */
function applyAgentResult(
  state: BaseMessage[],
  agentOutput: BaseMessage[]
): BaseMessage[] {
  return timestampedMessagesReducer(state, agentOutput);
}

describe("context message leakage across turns", () => {
  it("context persists in state in the correct position (before the human message)", () => {
    // ═══ SETUP: Turn 1 already happened ═══
    const turn1Human = new HumanMessage({ content: "Build my landing page", id: "h1" });
    const turn1AI = new AIMessage({
      content: "Your landing page is live!",
      id: "a1",
      additional_kwargs: { timestamp: "2026-02-12T12:00:00Z" },
    });

    let state: BaseMessage[] = [];
    state = timestampedMessagesReducer(state, [turn1Human]);
    state = timestampedMessagesReducer(state, [turn1AI]);

    // ═══ TURN 2: User reports page not displaying, frontend sends build errors ═══
    const turn2Human = new HumanMessage({ content: "My page isn't displaying correctly", id: "h2" });
    state = timestampedMessagesReducer(state, [turn2Human]);

    const buildErrorContext = createContextMessage(
      "[Build Errors — fix these]\n- [hmr] Failed to reload /src/index.css",
      { timestamp: "2026-02-12T12:01:00Z" }
    );

    const preparedForTurn2 = new Conversation(state).prepareTurn({
      contextMessages: [buildErrorContext],
    });

    // Verify context was injected before the human message
    const contextIdx = preparedForTurn2.findIndex(isContextMessage);
    const humanIdx = preparedForTurn2.findIndex(
      (m) => m._getType() === "human" && !isContextMessage(m) && m.id === "h2"
    );
    expect(contextIdx).toBeGreaterThanOrEqual(0);
    expect(humanIdx).toBeGreaterThan(contextIdx);

    // Agent processes prepared messages and returns full state + its response
    const turn2AIResponse = new AIMessage({
      content: "I've fixed the display issue!",
      id: "a2",
      additional_kwargs: { timestamp: "2026-02-12T12:02:00Z" },
    });
    const agentOutput = simulateAgentOutput(preparedForTurn2, [turn2AIResponse]);

    // reconcileForReducer + reducer preserves correct ordering
    state = applyAgentResult(state, agentOutput);

    // Context persists in state — correct (trace history).
    const stateContextMessages = state.filter(isContextMessage);
    expect(stateContextMessages.length).toBe(1);

    // Context is BEFORE h2 in state (not after), thanks to reconciliation
    const ctxIdx = state.findIndex(isContextMessage);
    const h2Idx = state.findIndex((m) => m.id === "h2");
    expect(ctxIdx).toBeLessThan(h2Idx);

    // parse() assigns context to Turn 2 (where it belongs)
    const conv = new Conversation(state);
    expect(conv.turns.length).toBe(2);
    const turn2Context = conv.turns[1]!.filter(isContextMessage);
    expect(turn2Context.length).toBe(1);

    // ═══ VERIFY: prepareTurn for Turn 3 keeps build errors in Turn 2, not Turn 3 ═══
    const turn3Human = new HumanMessage({ content: "Make tone more friendly", id: "h3" });
    state = timestampedMessagesReducer(state, [turn3Human]);

    const preparedForTurn3 = new Conversation(state).prepareTurn({
      contextMessages: [],
    });

    // Parse the prepared output — Turn 3 should have NO context
    const preparedConv = new Conversation(preparedForTurn3);
    const lastTurn = preparedConv.turns[preparedConv.turns.length - 1]!;
    const contextInLastTurn = lastTurn.filter(isContextMessage);
    expect(contextInLastTurn.length).toBe(0);
  });

  it("stale context does not attach to the wrong turn", () => {
    // ═══ SETUP: Full 2-turn history in state ═══
    const turn1Human = new HumanMessage({ content: "Build my landing page", id: "h1" });
    const turn1AI = new AIMessage({
      content: "Your landing page is live!",
      id: "a1",
      additional_kwargs: { timestamp: "2026-02-12T12:00:00Z" },
    });

    let state: BaseMessage[] = [];
    state = timestampedMessagesReducer(state, [turn1Human, turn1AI]);

    // Turn 2 with build error context
    const turn2Human = new HumanMessage({ content: "My page isn't displaying correctly", id: "h2" });
    state = timestampedMessagesReducer(state, [turn2Human]);

    const buildErrorContext = createContextMessage(
      "[Build Errors — fix these]\n- [hmr] Failed to reload /src/index.css",
      { timestamp: "2026-02-12T12:01:00Z" }
    );

    const preparedForTurn2 = new Conversation(state).prepareTurn({
      contextMessages: [buildErrorContext],
    });

    const turn2AIResponse = new AIMessage({
      content: "I've fixed the display issue!",
      id: "a2",
      additional_kwargs: { timestamp: "2026-02-12T12:02:00Z" },
    });

    const agentOutput = simulateAgentOutput(preparedForTurn2, [turn2AIResponse]);
    state = applyAgentResult(state, agentOutput);

    // ═══ TURN 3: User asks for copy change (no build errors!) ═══
    const turn3Human = new HumanMessage({ content: "Make tone more friendly", id: "h3" });
    state = timestampedMessagesReducer(state, [turn3Human]);

    // prepareTurn for Turn 3 with DIFFERENT context (copy instructions, no build errors)
    const copyContext = createContextMessage("Rewrite the copy in a friendly tone");

    const preparedForTurn3 = new Conversation(state).prepareTurn({
      contextMessages: [copyContext],
    });

    // ═══ VERIFY: Turn 3 should NOT have old build error context ═══
    const preparedConv = new Conversation(preparedForTurn3);
    const lastTurn = preparedConv.turns[preparedConv.turns.length - 1]!;
    const lastTurnContext = lastTurn.filter(isContextMessage);

    // Last turn should only have the fresh copy context, not stale build errors
    const buildErrorInLastTurn = lastTurnContext.find(
      (m) => typeof m.content === "string" && m.content.includes("Build Errors")
    );
    expect(buildErrorInLastTurn).toBeUndefined();

    // The copy context should be there
    const copyInLastTurn = lastTurnContext.find(
      (m) => typeof m.content === "string" && m.content.includes("friendly tone")
    );
    expect(copyInLastTurn).toBeDefined();
  });

  it("context messages from prepareTurn do not accumulate across many turns", () => {
    let state: BaseMessage[] = [];

    // Turn 1
    const h1 = new HumanMessage({ content: "Build page", id: "h1" });
    state = timestampedMessagesReducer(state, [h1]);

    const ctx1 = createContextMessage("[Context] User uploaded hero.jpg");
    const prepared1 = new Conversation(state).prepareTurn({ contextMessages: [ctx1] });
    const a1 = new AIMessage({ content: "Built!", id: "a1", additional_kwargs: { timestamp: "2026-02-12T12:00:00Z" } });
    state = applyAgentResult(state, simulateAgentOutput(prepared1, [a1]));

    // Turn 2
    const h2 = new HumanMessage({ content: "Change colors", id: "h2" });
    state = timestampedMessagesReducer(state, [h2]);

    const ctx2 = createContextMessage("[Build Errors]\n- Missing import");
    const prepared2 = new Conversation(state).prepareTurn({ contextMessages: [ctx2] });
    const a2 = new AIMessage({ content: "Fixed!", id: "a2", additional_kwargs: { timestamp: "2026-02-12T12:01:00Z" } });
    state = applyAgentResult(state, simulateAgentOutput(prepared2, [a2]));

    // Turn 3
    const h3 = new HumanMessage({ content: "Update copy", id: "h3" });
    state = timestampedMessagesReducer(state, [h3]);

    const ctx3 = createContextMessage("Rewrite copy professionally");
    const prepared3 = new Conversation(state).prepareTurn({ contextMessages: [ctx3] });

    // ═══ VERIFY: Turn 3's context should only have ctx3, not ctx1 or ctx2 ═══
    const preparedConv = new Conversation(prepared3);
    const lastTurn = preparedConv.turns[preparedConv.turns.length - 1]!;
    const lastTurnContext = lastTurn.filter(isContextMessage);

    // Only the fresh context for this turn
    const staleInLastTurn = lastTurnContext.filter(
      (m) => typeof m.content === "string" &&
        (m.content.includes("hero.jpg") || m.content.includes("Build Errors"))
    );
    expect(staleInLastTurn.length).toBe(0);

    // ctx3 should be there
    const freshInLastTurn = lastTurnContext.find(
      (m) => typeof m.content === "string" && m.content.includes("professionally")
    );
    expect(freshInLastTurn).toBeDefined();
  });
});
