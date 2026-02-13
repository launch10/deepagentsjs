/**
 * Silver bullet integration test: context stays with its turn across
 * prepareTurn, agent processing, reducer reconciliation, and compaction.
 *
 * Uses a real StateGraph with timestampedMessagesReducer + MemorySaver.
 * The mock agent node mirrors what the real coding agent does:
 *   1. Calls Conversation.prepareTurn() with context messages
 *   2. "Processes" (appends a mock AI response)
 *   3. Returns [...prepared, aiResponse] through the reducer
 *
 * The reducer's reconcileOrdering logic ensures context stays before
 * the human message it was injected for — even though the reducer
 * deduplicates by ID and would otherwise lock existing messages in place.
 *
 * Verifies:
 * - Each turn's context stays with that turn (no leakage)
 * - Context survives compaction for kept turns
 * - Post-compaction turns still work correctly
 */
import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, StateGraph, END, MemorySaver } from "@langchain/langgraph";
import { createContextMessage, isContextMessage, isSummaryMessage } from "langgraph-ai-sdk";
import { timestampedMessagesReducer } from "@annotation";
import { Conversation } from "@conversation";
import { mockSummarizer } from "@support";

// ============================================================================
// TEST GRAPH — mirrors the real website builder flow
// ============================================================================

const ContextTestAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: timestampedMessagesReducer,
  }),
  /** Context to inject on the next agent turn (consumed after use) */
  pendingContext: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: (_current: BaseMessage[], next: BaseMessage[]) => next,
  }),
  /** AI response content for the mock agent */
  mockResponse: Annotation<string>({
    default: () => "",
    reducer: (_current: string, next: string) => next,
  }),
});

type ContextTestState = typeof ContextTestAnnotation.State;

/**
 * Mock agent node that mirrors the real coding agent flow:
 * 1. prepareTurn injects pendingContext before the last human message
 * 2. Agent "processes" (appends a canned AI response)
 * 3. Returns full prepared messages + response through the reducer
 */
function agentNode(state: ContextTestState): { messages: BaseMessage[] } {
  const prepared = new Conversation(state.messages).prepareTurn({
    contextMessages: state.pendingContext,
  });

  const aiResponse = new AIMessage({
    content: state.mockResponse || "Done.",
    additional_kwargs: { timestamp: new Date().toISOString() },
  });

  // Return everything — like deepagents' agent.invoke() returns full state
  return { messages: [...prepared, aiResponse] };
}

function buildTestGraph() {
  return new StateGraph(ContextTestAnnotation)
    .addNode("agent", agentNode)
    .addEdge("__start__", "agent")
    .addEdge("agent", END)
    .compile({ checkpointer: new MemorySaver(), name: "context-integration-test" });
}

// ============================================================================
// HELPERS
// ============================================================================

/** Extract context messages from a specific turn (by turn index, 0-based). */
function contextInTurn(conv: Conversation, turnIdx: number): BaseMessage[] {
  if (turnIdx >= conv.turns.length) return [];
  return conv.turns[turnIdx]!.filter(isContextMessage);
}

/** Get text content of context messages in a turn. */
function contextTexts(conv: Conversation, turnIdx: number): string[] {
  return contextInTurn(conv, turnIdx).map((m) =>
    typeof m.content === "string" ? m.content : ""
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe("context integration: prepareTurn + reducer + compact (real graph)", () => {
  it("multi-turn with per-turn context: each context stays with its turn through compaction", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "ctx-integration-1" } };

    // ── Turn 1: build errors ─────────────────────────────────
    await graph.invoke(
      {
        messages: [new HumanMessage({ content: "Build my landing page", id: "h1" })],
        pendingContext: [
          createContextMessage("[Build Errors — fix these]\n- [hmr] Failed to reload /src/index.css"),
        ],
        mockResponse: "I've built your landing page and fixed the CSS error.",
      },
      config
    );

    let checkpoint = await graph.getState(config);
    let conv = new Conversation(checkpoint.values.messages);

    // Turn 1 should have the build error context
    expect(conv.turns.length).toBe(1);
    expect(contextTexts(conv, 0).some((t) => t.includes("Build Errors"))).toBe(true);

    // ── Turn 2: image upload ─────────────────────────────────
    await graph.invoke(
      {
        messages: [new HumanMessage({ content: "Use this hero image", id: "h2" })],
        pendingContext: [
          createContextMessage("[Context] User uploaded hero.jpg"),
        ],
        mockResponse: "I've added the hero image to the page.",
      },
      config
    );

    checkpoint = await graph.getState(config);
    conv = new Conversation(checkpoint.values.messages);

    expect(conv.turns.length).toBe(2);

    // Turn 1 still has build errors, NOT image upload
    expect(contextTexts(conv, 0).some((t) => t.includes("Build Errors"))).toBe(true);
    expect(contextTexts(conv, 0).some((t) => t.includes("hero.jpg"))).toBe(false);

    // Turn 2 has image upload, NOT build errors
    expect(contextTexts(conv, 1).some((t) => t.includes("hero.jpg"))).toBe(true);
    expect(contextTexts(conv, 1).some((t) => t.includes("Build Errors"))).toBe(false);

    // ── Turn 3: copy instructions (no context) ───────────────
    await graph.invoke(
      {
        messages: [new HumanMessage({ content: "Make tone more friendly", id: "h3" })],
        pendingContext: [],
        mockResponse: "I've rewritten the copy in a friendlier tone.",
      },
      config
    );

    checkpoint = await graph.getState(config);
    conv = new Conversation(checkpoint.values.messages);

    expect(conv.turns.length).toBe(3);

    // Turn 3 has NO context — no leakage from turns 1 or 2
    expect(contextInTurn(conv, 2).length).toBe(0);

    // Turns 1 and 2 still have their original context
    expect(contextTexts(conv, 0).some((t) => t.includes("Build Errors"))).toBe(true);
    expect(contextTexts(conv, 1).some((t) => t.includes("hero.jpg"))).toBe(true);

    // ── Turn 4: new build errors ─────────────────────────────
    await graph.invoke(
      {
        messages: [new HumanMessage({ content: "Add a CTA section", id: "h4" })],
        pendingContext: [
          createContextMessage("[Build Errors — fix these]\n- Missing import: Button component"),
        ],
        mockResponse: "Added CTA section and fixed the import error.",
      },
      config
    );

    checkpoint = await graph.getState(config);
    conv = new Conversation(checkpoint.values.messages);

    expect(conv.turns.length).toBe(4);

    // Turn 4 has the NEW build errors, not the old ones
    const turn4Ctx = contextTexts(conv, 3);
    expect(turn4Ctx.some((t) => t.includes("Button component"))).toBe(true);
    expect(turn4Ctx.some((t) => t.includes("index.css"))).toBe(false);

    // ── Turn 5: more edits ───────────────────────────────────
    await graph.invoke(
      {
        messages: [new HumanMessage({ content: "Change the color scheme", id: "h5" })],
        pendingContext: [],
        mockResponse: "Updated the color scheme.",
      },
      config
    );

    // ── Turn 6: final touch ──────────────────────────────────
    await graph.invoke(
      {
        messages: [new HumanMessage({ content: "Fix the footer spacing", id: "h6" })],
        pendingContext: [
          createContextMessage("[Build Errors — fix these]\n- Tailwind class not found: pb-20"),
        ],
        mockResponse: "Fixed footer spacing and the Tailwind class issue.",
      },
      config
    );

    checkpoint = await graph.getState(config);
    conv = new Conversation(checkpoint.values.messages);

    expect(conv.turns.length).toBe(6);

    // ── COMPACT: summarize old turns, keep recent ────────────
    const compactResult = await conv.compact({
      messageThreshold: 3,
      keepRecent: 3, // keep turns 4, 5, 6
      summarizer: mockSummarizer,
    });
    expect(compactResult).not.toBeNull();

    // Apply compaction through the graph's reducer
    await graph.invoke(
      { messages: compactResult!.toMessages() },
      config
    );

    checkpoint = await graph.getState(config);
    conv = new Conversation(checkpoint.values.messages);

    // Should have a summary + 3 recent turns
    expect(conv.summaryMessages.length).toBe(1);
    expect(isSummaryMessage(conv.summaryMessages[0]!)).toBe(true);
    expect(conv.turns.length).toBe(3); // turns 4, 5, 6

    // Old context (build errors from turn 1, hero.jpg from turn 2) is gone — summarized away
    const allContextAfterCompaction = conv.turns
      .flatMap((t) => t.filter(isContextMessage))
      .map((m) => (typeof m.content === "string" ? m.content : ""));

    expect(allContextAfterCompaction.some((t) => t.includes("index.css"))).toBe(false);
    expect(allContextAfterCompaction.some((t) => t.includes("hero.jpg"))).toBe(false);

    // Kept turns still have their context:
    // Turn 4 (now index 0) — "Button component" build errors
    expect(contextTexts(conv, 0).some((t) => t.includes("Button component"))).toBe(true);

    // Turn 5 (now index 1) — no context
    expect(contextInTurn(conv, 1).length).toBe(0);

    // Turn 6 (now index 2) — "pb-20" build errors
    expect(contextTexts(conv, 2).some((t) => t.includes("pb-20"))).toBe(true);

    // ── Post-compaction turn: context still works ────────────
    await graph.invoke(
      {
        messages: [new HumanMessage({ content: "Add social proof section", id: "h7" })],
        pendingContext: [
          createContextMessage("[Context] User selected testimonial template"),
        ],
        mockResponse: "Added social proof with testimonials.",
      },
      config
    );

    checkpoint = await graph.getState(config);
    conv = new Conversation(checkpoint.values.messages);

    // New turn should have its context, no leakage
    const lastTurn = conv.turns[conv.turns.length - 1]!;
    const lastCtx = lastTurn.filter(isContextMessage);
    expect(lastCtx.length).toBe(1);
    expect(
      typeof lastCtx[0]!.content === "string" &&
        lastCtx[0]!.content.includes("testimonial template")
    ).toBe(true);

    // No stale context leaked into the new turn
    const lastCtxTexts = lastCtx.map((m) =>
      typeof m.content === "string" ? m.content : ""
    );
    expect(lastCtxTexts.some((t) => t.includes("Build Errors"))).toBe(false);
    expect(lastCtxTexts.some((t) => t.includes("hero.jpg"))).toBe(false);

    // Summary still intact after post-compaction turn
    expect(conv.summaryMessages.length).toBe(1);
  });
});
