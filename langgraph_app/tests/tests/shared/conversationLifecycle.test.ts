/**
 * Multi-turn conversation lifecycle tests.
 *
 * Uses a real test graph with NodeMiddleware.use for Polly caching.
 * A simple agent with 3 tools (get_time, echo, add_numbers) exercises
 * the full prepare → agent → compact → prepare cycle.
 *
 * Verifies:
 * - Append-only behavior across multiple graph invocations
 * - prepareTurn output is ephemeral (never persisted in state)
 * - Double compaction consolidates into one summary
 * - Compaction is idempotent through the reducer
 */
import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage, RemoveMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, StateGraph, END, MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { NodeMiddleware } from "@middleware";
import { getLLM } from "@core";
import { createDeepAgent } from "deepagents";
import { timestampedMessagesReducer } from "@annotation";
import { Conversation } from "@conversation";
import { createContextMessage, isSummaryMessage } from "langgraph-ai-sdk";
import { mockSummarizer, makeSimpleTurns } from "@support";
import { generateUUID } from "@types";

// ============================================================================
// TEST GRAPH SETUP
// ============================================================================

const LifecycleAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: timestampedMessagesReducer,
  }),
  threadId: Annotation<string>({
    default: () => "",
    reducer: (_: string, next: string) => next,
  }),
  jwt: Annotation<string>({
    default: () => "",
    reducer: (_: string, next: string) => next,
  }),
});

type LifecycleState = typeof LifecycleAnnotation.State;

// ── Simple tools ────────────────────────────────────────────────

const getTimeTool = tool(
  async () => "The current time is 2024-06-15T12:00:00Z",
  {
    name: "get_time",
    description: "Get the current time",
    schema: z.object({}),
  }
);

const echoTool = tool(
  async ({ message }: { message: string }) => `Echo: ${message}`,
  {
    name: "echo",
    description: "Echo a message back",
    schema: z.object({ message: z.string() }),
  }
);

const addNumbersTool = tool(
  async ({ a, b }: { a: number; b: number }) => `${a + b}`,
  {
    name: "add_numbers",
    description: "Add two numbers",
    schema: z.object({ a: z.number(), b: z.number() }),
  }
);

// ── Agent node using NodeMiddleware + deepagent ─────────────────

const agentNode = NodeMiddleware.use(
  {},
  (async (state: LifecycleState) => {
    const llm = await getLLM();
    const agent = createDeepAgent({
      model: llm as any,
      name: "lifecycle-test-agent",
      systemPrompt:
        "You are a helpful assistant. Use the tools provided to answer questions. Be brief.",
      tools: [getTimeTool, echoTool, addNumbersTool],
    });

    const result = await agent.invoke({ messages: state.messages });
    return { messages: result.messages };
  }) as any
);

// ── Build graph ─────────────────────────────────────────────────

function buildLifecycleGraph() {
  return new StateGraph(LifecycleAnnotation)
    .addNode("agent", agentNode)
    .addEdge("__start__", "agent")
    .addEdge("agent", END)
    .compile({ checkpointer: new MemorySaver(), name: "lifecycle-test" });
}

// ============================================================================
// TESTS
// ============================================================================

describe.sequential("conversation lifecycle (real graph)", () => {
  // ── Test 1 ────────────────────────────────────────────────────

  it("full lifecycle: N turns append-only, compaction, M more turns append-only", async () => {
    const graph = buildLifecycleGraph();
    const threadId = generateUUID();
    const config = { configurable: { thread_id: threadId } };

    // ── Turn 1 ──
    await graph.invoke(
      { messages: [new HumanMessage("What time is it?")] },
      config
    );
    let checkpoint = await graph.getState(config);
    const snap1 = [...checkpoint.values.messages];
    expect(snap1.length).toBeGreaterThanOrEqual(2); // at least human + AI

    // ── Turn 2 ──
    await graph.invoke(
      { messages: [new HumanMessage("Echo hello")] },
      config
    );
    checkpoint = await graph.getState(config);
    const snap2 = [...checkpoint.values.messages];

    // Prefix stability: snap2 starts with snap1
    for (let i = 0; i < snap1.length; i++) {
      expect(snap2[i]!.id).toBe(snap1[i]!.id);
    }

    // ── Turn 3 ──
    await graph.invoke(
      { messages: [new HumanMessage("Add 3 and 7")] },
      config
    );
    checkpoint = await graph.getState(config);
    const snap3 = [...checkpoint.values.messages];

    // Prefix stability: snap3 starts with snap2
    for (let i = 0; i < snap2.length; i++) {
      expect(snap3[i]!.id).toBe(snap2[i]!.id);
    }

    // ── Turn 4 ──
    await graph.invoke(
      { messages: [new HumanMessage("What is 10 plus 20?")] },
      config
    );
    checkpoint = await graph.getState(config);
    const snap4 = [...checkpoint.values.messages];

    // Prefix stability: snap4 starts with snap3
    for (let i = 0; i < snap3.length; i++) {
      expect(snap4[i]!.id).toBe(snap3[i]!.id);
    }

    // ── Compact ──
    const conv = new Conversation(checkpoint.values.messages);
    const compactResult = await conv.compact({
      messageThreshold: 2,
      keepRecent: 2,
      summarizer: mockSummarizer,
    });
    expect(compactResult).not.toBeNull();

    // Apply compaction through the graph (via reducer)
    await graph.invoke(
      { messages: compactResult!.toMessages() },
      config
    );
    checkpoint = await graph.getState(config);
    const postCompaction = [...checkpoint.values.messages];

    // Should have a summary message
    const summaries = postCompaction.filter(m => isSummaryMessage(m));
    expect(summaries.length).toBe(1);

    // Should have fewer messages than before compaction
    expect(postCompaction.length).toBeLessThan(snap4.length);

    // ── Turn 5 (post-compaction) ──
    await graph.invoke(
      { messages: [new HumanMessage("Echo world")] },
      config
    );
    checkpoint = await graph.getState(config);
    const snap5 = [...checkpoint.values.messages];

    // Prefix stability: snap5 starts with postCompaction
    for (let i = 0; i < postCompaction.length; i++) {
      expect(snap5[i]!.id).toBe(postCompaction[i]!.id);
    }

    // ── Turn 6 (post-compaction) ──
    await graph.invoke(
      { messages: [new HumanMessage("What time is it now?")] },
      config
    );
    checkpoint = await graph.getState(config);
    const snap6 = [...checkpoint.values.messages];

    // Prefix stability: snap6 starts with snap5
    for (let i = 0; i < snap5.length; i++) {
      expect(snap6[i]!.id).toBe(snap5[i]!.id);
    }

    // Summary survives through post-compaction turns
    const finalSummaries = snap6.filter(m => isSummaryMessage(m));
    expect(finalSummaries.length).toBe(1);
  });

  // ── Test 2 ────────────────────────────────────────────────────

  it("prepareTurn output is ephemeral — never persisted in state", async () => {
    const graph = buildLifecycleGraph();
    const threadId = generateUUID();
    const config = { configurable: { thread_id: threadId } };

    // ── Turn 1 ──
    await graph.invoke(
      { messages: [new HumanMessage("What time is it?")] },
      config
    );
    let checkpoint = await graph.getState(config);

    // Call prepareTurn with context messages
    const conv1 = new Conversation(checkpoint.values.messages);
    const prepared1 = conv1.prepareTurn({
      contextMessages: [createContextMessage("test context alpha")],
    });

    // prepared1 has context
    const hasContext1 = prepared1.some(
      (m: BaseMessage) =>
        (m as any).name === "context" &&
        typeof m.content === "string" &&
        m.content === "test context alpha"
    );
    expect(hasContext1).toBe(true);

    // State does NOT contain that context message
    const stateHasContext1 = checkpoint.values.messages.some(
      (m: BaseMessage) =>
        (m as any).name === "context" &&
        typeof m.content === "string" &&
        m.content === "test context alpha"
    );
    expect(stateHasContext1).toBe(false);

    // ── Turn 2 ──
    await graph.invoke(
      { messages: [new HumanMessage("Echo something")] },
      config
    );
    checkpoint = await graph.getState(config);

    // Call prepareTurn again with different context
    const conv2 = new Conversation(checkpoint.values.messages);
    const prepared2 = conv2.prepareTurn({
      contextMessages: [createContextMessage("test context beta")],
    });

    // prepared2 has the new context
    const hasContext2 = prepared2.some(
      (m: BaseMessage) =>
        (m as any).name === "context" &&
        typeof m.content === "string" &&
        m.content === "test context beta"
    );
    expect(hasContext2).toBe(true);

    // State does NOT contain either context message
    const stateHasBeta = checkpoint.values.messages.some(
      (m: BaseMessage) =>
        (m as any).name === "context" &&
        typeof m.content === "string" &&
        m.content === "test context beta"
    );
    expect(stateHasBeta).toBe(false);

    const stateHasAlpha = checkpoint.values.messages.some(
      (m: BaseMessage) =>
        (m as any).name === "context" &&
        typeof m.content === "string" &&
        m.content === "test context alpha"
    );
    expect(stateHasAlpha).toBe(false);
  });

  // ── Test 3 ────────────────────────────────────────────────────

  it("two compaction rounds with continued appending", async () => {
    const graph = buildLifecycleGraph();
    const threadId = generateUUID();
    const config = { configurable: { thread_id: threadId } };

    // ── 8 turns ──
    const prompts = [
      "What time is it?",
      "Echo hello",
      "Add 1 and 2",
      "Echo goodbye",
      "Add 10 and 20",
      "What time is it again?",
      "Echo test",
      "Add 5 and 5",
    ];

    for (const prompt of prompts) {
      await graph.invoke(
        { messages: [new HumanMessage(prompt)] },
        config
      );
    }

    let checkpoint = await graph.getState(config);
    const pre1stCompact = [...checkpoint.values.messages];

    // ── First compaction ──
    const conv1 = new Conversation(checkpoint.values.messages);
    const result1 = await conv1.compact({
      messageThreshold: 3,
      keepRecent: 3,
      summarizer: mockSummarizer,
    });
    expect(result1).not.toBeNull();

    await graph.invoke(
      { messages: result1!.toMessages() },
      config
    );
    checkpoint = await graph.getState(config);
    const post1stCompact = [...checkpoint.values.messages];

    // Exactly one summary after first compaction
    const summaries1 = post1stCompact.filter(m => isSummaryMessage(m));
    expect(summaries1.length).toBe(1);
    expect(post1stCompact.length).toBeLessThan(pre1stCompact.length);

    // ── 4 more turns ──
    const morePrompts = [
      "Echo round two",
      "Add 100 and 200",
      "What time is it now?",
      "Echo final",
    ];

    for (const prompt of morePrompts) {
      await graph.invoke(
        { messages: [new HumanMessage(prompt)] },
        config
      );
    }

    checkpoint = await graph.getState(config);
    const pre2ndCompact = [...checkpoint.values.messages];

    // ── Second compaction ──
    const conv2 = new Conversation(checkpoint.values.messages);
    const result2 = await conv2.compact({
      messageThreshold: 3,
      keepRecent: 3,
      summarizer: mockSummarizer,
    });
    expect(result2).not.toBeNull();

    await graph.invoke(
      { messages: result2!.toMessages() },
      config
    );
    checkpoint = await graph.getState(config);
    const post2ndCompact = [...checkpoint.values.messages];

    // Still exactly one summary (consolidated)
    const summaries2 = post2ndCompact.filter(m => isSummaryMessage(m));
    expect(summaries2.length).toBe(1);

    // The new summary should incorporate the prior summary
    const summaryContent = summaries2[0]!.content as string;
    expect(summaryContent).toContain("Previous:");

    // Recent turns should still be intact
    expect(post2ndCompact.length).toBeLessThan(pre2ndCompact.length);

    // The most recent human messages should survive
    const humanContents = post2ndCompact
      .filter((m) => m._getType() === "human")
      .map((m) => (typeof m.content === "string" ? m.content : ""));
    expect(humanContents.some((c) => c === "Echo final")).toBe(true);
  });

  // ── Test 4 ────────────────────────────────────────────────────

  it("compaction output is idempotent — second compact is a no-op", async () => {
    // Build state with enough turns to trigger compaction
    const rawMessages = makeSimpleTurns(8);

    // Initialize through the timestamped reducer (assigns IDs like production)
    let state: BaseMessage[] = [];
    for (const msg of rawMessages) {
      state = timestampedMessagesReducer(state, [msg]);
    }

    const opts = {
      messageThreshold: 3,
      keepRecent: 3,
      summarizer: mockSummarizer,
    };

    // First compaction
    const conv1 = new Conversation(state);
    const result1 = await conv1.compact(opts);
    expect(result1).not.toBeNull();

    // Apply first compaction through reducer
    const afterFirst = timestampedMessagesReducer(state, result1!.toMessages());

    // Second compaction — should be null (already under thresholds)
    const conv2 = new Conversation(afterFirst);
    const result2 = await conv2.compact(opts);
    expect(result2).toBeNull();

    // State is unchanged since no compaction was applied
    expect(afterFirst.length).toBeGreaterThan(0);
    // Should have exactly one summary + recent turns
    const summaries = afterFirst.filter(m => isSummaryMessage(m));
    expect(summaries.length).toBe(1);
  });
});
