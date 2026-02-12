/**
 * Tests for the Conversation class.
 *
 * Defines what a "turn" is, how windowing works, how context and
 * summaries are handled. Pure functions — no mocks, no API calls.
 *
 * A Turn is a BaseMessage[] slice: from one non-context HumanMessage
 * through everything before the next non-context HumanMessage.
 * Context messages preceding the human message are part of that turn.
 */
import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage, ToolMessage, RemoveMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { createContextMessage, isSummaryMessage } from "langgraph-ai-sdk";
import { messagesStateReducer } from "@langchain/langgraph";
import { Conversation } from "@conversation";

// ── Helpers ──────────────────────────────────────────────────────

/** Create a summary message (AIMessage with [[[CONVERSATION SUMMARY]]]). */
function makeSummary(text: string, id?: string) {
  return new AIMessage({
    content: `[[[CONVERSATION SUMMARY]]]\n${text}`,
    name: "context",
    id: id ?? `summary-${Date.now()}`,
    additional_kwargs: { isSummary: true },
  });
}

/** Create N simple human+AI turn pairs. */
function makeSimpleTurns(count: number, startId = 1) {
  const msgs = [];
  for (let i = 0; i < count; i++) {
    const idx = startId + i;
    msgs.push(new HumanMessage({ content: `User message ${idx}`, id: `h${idx}` }));
    msgs.push(new AIMessage({ content: `AI response ${idx}`, id: `a${idx}` }));
  }
  return msgs;
}

/** Create a turn with tool calls: Human → AI(tool_calls) → ToolMessage(s) → AI(final). */
function makeTurnWithTools(turnIdx: number, toolCount = 2) {
  const msgs: any[] = [];
  msgs.push(new HumanMessage({ content: `User turn ${turnIdx}`, id: `h${turnIdx}` }));
  msgs.push(new AIMessage({
    content: "Working...",
    id: `a${turnIdx}-tc`,
    tool_calls: Array.from({ length: toolCount }, (_, j) => ({
      id: `tc-${turnIdx}-${j}`,
      name: `tool_${j}`,
      args: {},
      type: "tool_call" as const,
    })),
  }));
  for (let j = 0; j < toolCount; j++) {
    msgs.push(new ToolMessage({
      content: `Tool result ${j}`,
      id: `t${turnIdx}-${j}`,
      tool_call_id: `tc-${turnIdx}-${j}`,
    }));
  }
  msgs.push(new AIMessage({ content: `Done ${turnIdx}`, id: `a${turnIdx}-final` }));
  return msgs;
}

/** Get IDs from a message array, using "ctx" for context messages without IDs. */
function ids(msgs: any[]) {
  return msgs.map((m: any) => m.id ?? "ctx");
}

// ── Turn Parsing ─────────────────────────────────────────────────

describe("Conversation", () => {
  describe("turn parsing", () => {
    it("parses simple human+AI pairs as turns", () => {
      const msgs = makeSimpleTurns(3);
      const conv = new Conversation(msgs);

      expect(conv.humanTurnCount).toBe(3);
      // Each turn is [HumanMessage, AIMessage]
      expect(conv.turns[0]!.length).toBe(2);
      expect(conv.turns[0]![0]!.id).toBe("h1");
      expect(conv.turns[0]![1]!.id).toBe("a1");
    });

    it("includes tool messages in the same turn as their AI message", () => {
      const msgs = makeTurnWithTools(1, 3);
      const conv = new Conversation(msgs);

      expect(conv.humanTurnCount).toBe(1);
      // Turn = [Human, AI(tool_calls), Tool, Tool, Tool, AI(final)]
      expect(conv.turns[0]!.length).toBe(6);
    });

    it("includes context messages at the start of the turn they precede", () => {
      const msgs = [
        new HumanMessage({ content: "First", id: "h1" }),
        new AIMessage({ content: "Response 1", id: "a1" }),
        createContextMessage("images uploaded"),
        createContextMessage("brainstorm finished"),
        new HumanMessage({ content: "Second", id: "h2" }),
        new AIMessage({ content: "Response 2", id: "a2" }),
      ];
      const conv = new Conversation(msgs);

      expect(conv.humanTurnCount).toBe(2);
      // Turn 1: [h1, a1] — no context
      expect(conv.turns[0]!.length).toBe(2);
      // Turn 2: [ctx, ctx, h2, a2] — context precedes the human message
      expect(conv.turns[1]!.length).toBe(4);
      expect((conv.turns[1]![0]! as any).name).toBe("context");
      expect((conv.turns[1]![1]! as any).name).toBe("context");
      expect(conv.turns[1]![2]!.id).toBe("h2");
    });

    it("separates summary messages from turns", () => {
      const summary = makeSummary("Built a landing page.", "sum1");
      const msgs = [
        summary,
        new HumanMessage({ content: "Change headline", id: "h1" }),
        new AIMessage({ content: "Changed", id: "a1" }),
      ];
      const conv = new Conversation(msgs);

      expect(conv.summaryMessages.length).toBe(1);
      expect(conv.summaryMessages[0]!.id).toBe("sum1");
      expect(conv.humanTurnCount).toBe(1);
    });

    it("handles unanswered human message as a turn with no AI", () => {
      const msgs = [
        new HumanMessage({ content: "First", id: "h1" }),
        new AIMessage({ content: "Response", id: "a1" }),
        new HumanMessage({ content: "Pending", id: "h2" }),
      ];
      const conv = new Conversation(msgs);

      expect(conv.humanTurnCount).toBe(2);
      expect(conv.turns[1]!.length).toBe(1); // Just [h2]
      expect(conv.turns[1]![0]!.id).toBe("h2");
    });

    it("handles empty message array", () => {
      const conv = new Conversation([]);
      expect(conv.humanTurnCount).toBe(0);
      expect(conv.summaryMessages.length).toBe(0);
      expect(conv.trailingMessages.length).toBe(0);
    });

    it("puts context-only messages (no human) in trailingMessages", () => {
      const msgs = [
        createContextMessage("brainstorm context"),
        createContextMessage("image context"),
      ];
      const conv = new Conversation(msgs);

      expect(conv.humanTurnCount).toBe(0);
      expect(conv.trailingMessages.length).toBe(2);
    });

    it("handles multi-step tool use in a single turn", () => {
      // Human → AI(tc) → Tool → AI(tc) → Tool → AI(final)
      const msgs = [
        new HumanMessage({ content: "Build page", id: "h1" }),
        new AIMessage({
          content: "Step 1", id: "a1-s1",
          tool_calls: [{ id: "tc1", name: "write", args: {}, type: "tool_call" as const }],
        }),
        new ToolMessage({ content: "Wrote file", tool_call_id: "tc1", id: "t1" }),
        new AIMessage({
          content: "Step 2", id: "a1-s2",
          tool_calls: [{ id: "tc2", name: "write", args: {}, type: "tool_call" as const }],
        }),
        new ToolMessage({ content: "Wrote file 2", tool_call_id: "tc2", id: "t2" }),
        new AIMessage({ content: "All done", id: "a1-final" }),
      ];
      const conv = new Conversation(msgs);

      expect(conv.humanTurnCount).toBe(1);
      // All 6 messages in one turn
      expect(conv.turns[0]!.length).toBe(6);
    });
  });

  // ── Round-trip: parse → toMessages ──────────────────────────────

  describe("toMessages round-trip", () => {
    it("reconstructs simple turn order", () => {
      const msgs = makeSimpleTurns(5);
      const conv = new Conversation(msgs);
      expect(ids(conv.toMessages())).toEqual(ids(msgs));
    });

    it("keeps context in correct position", () => {
      const msgs = [
        new HumanMessage({ content: "First", id: "h1" }),
        new AIMessage({ content: "R1", id: "a1" }),
        createContextMessage("between turns"),
        new HumanMessage({ content: "Second", id: "h2" }),
        new AIMessage({ content: "R2", id: "a2" }),
      ];
      const conv = new Conversation(msgs);
      expect(ids(conv.toMessages())).toEqual(ids(msgs));
    });

    it("places summaries at front even if they were mid-array", () => {
      const summary = makeSummary("old summary", "sum1");
      const msgs = [
        new HumanMessage({ content: "First", id: "h1" }),
        summary,
        new HumanMessage({ content: "Second", id: "h2" }),
        new AIMessage({ content: "R2", id: "a2" }),
      ];
      const conv = new Conversation(msgs);
      const result = conv.toMessages();

      // Summary moves to front
      expect(result[0]!.id).toBe("sum1");
    });
  });

  // ── Windowing ──────────────────────────────────────────────────

  describe("window", () => {
    it("returns all messages when within limits", () => {
      const msgs = makeSimpleTurns(3);
      const conv = new Conversation(msgs);
      const windowed = conv.window({ maxTurnPairs: 10, maxChars: 40_000 });
      expect(windowed.length).toBe(6);
    });

    it("keeps only the most recent N turns", () => {
      const msgs = makeSimpleTurns(15);
      const conv = new Conversation(msgs);
      const windowed = conv.window({ maxTurnPairs: 3 });

      const humanIds = windowed
        .filter(m => m._getType() === "human")
        .map(m => m.id);
      expect(humanIds).toEqual(["h13", "h14", "h15"]);
    });

    it("drops old ephemeral context when outside the window", () => {
      const msgs = [
        createContextMessage("old brainstorm context"),
        ...makeSimpleTurns(15),
      ];
      const conv = new Conversation(msgs);
      const windowed = conv.window({ maxTurnPairs: 3 });

      const contextInResult = windowed.filter(
        m => (m as any).name === "context"
      );
      // Old context from turn 1 should be dropped (outside window)
      expect(contextInResult.length).toBe(0);
    });

    it("keeps fresh context that belongs to a kept turn", () => {
      const msgs = [
        ...makeSimpleTurns(13),
        createContextMessage("fresh image context"),
        new HumanMessage({ content: "Use those images", id: "h14" }),
        new AIMessage({ content: "Done", id: "a14" }),
        new HumanMessage({ content: "Latest", id: "h15" }),
        new AIMessage({ content: "Ok", id: "a15" }),
      ];
      const conv = new Conversation(msgs);
      const windowed = conv.window({ maxTurnPairs: 3 });

      const contextInResult = windowed.filter(
        m => (m as any).name === "context"
      );
      // Context before h14 belongs to turn 14, which is in the last 3
      expect(contextInResult.length).toBe(1);
    });

    it("always preserves summary messages at the front", () => {
      const summary = makeSummary("Built a landing page.", "sum1");
      const msgs = [summary, ...makeSimpleTurns(15)];
      const conv = new Conversation(msgs);
      const windowed = conv.window({ maxTurnPairs: 3 });

      expect(windowed[0]!.id).toBe("sum1");
      expect((windowed[0] as any).content).toContain("[[[CONVERSATION SUMMARY]]]");
    });

    it("context messages don't count as turns", () => {
      const msgs: any[] = [];
      for (let i = 1; i <= 5; i++) {
        msgs.push(createContextMessage(`context ${i}a`));
        msgs.push(createContextMessage(`context ${i}b`));
        msgs.push(new HumanMessage({ content: `Msg ${i}`, id: `h${i}` }));
        msgs.push(new AIMessage({ content: `Reply ${i}`, id: `a${i}` }));
      }
      const conv = new Conversation(msgs);

      expect(conv.humanTurnCount).toBe(5);
      const windowed = conv.window({ maxTurnPairs: 10 });
      // All 5 turns + their context fit since 5 < 10
      const humanIds = windowed
        .filter(m => m._getType() === "human" && (m as any).name !== "context")
        .map(m => m.id);
      expect(humanIds.length).toBe(5);
    });

    it("respects maxChars limit", () => {
      const longContent = "x".repeat(15_000);
      const msgs = [
        new HumanMessage({ content: longContent, id: "h1" }),
        new AIMessage({ content: longContent, id: "a1" }),
        new HumanMessage({ content: longContent, id: "h2" }),
        new AIMessage({ content: longContent, id: "a2" }),
        new HumanMessage({ content: "recent", id: "h3" }),
        new AIMessage({ content: "recent reply", id: "a3" }),
      ];
      const conv = new Conversation(msgs);
      const windowed = conv.window({ maxChars: 40_000 });

      const resultIds = windowed.map(m => m.id);
      expect(resultIds).toContain("a3");
      expect(windowed.length).toBeLessThan(6);
    });

    it("preserves context right before its human message (not moved to front)", () => {
      const msgs = [
        ...makeSimpleTurns(5),
        createContextMessage("just uploaded 3 images"),
        new HumanMessage({ content: "incorporate my images", id: "h6" }),
        new AIMessage({ content: "Done", id: "a6" }),
      ];
      const conv = new Conversation(msgs);
      const windowed = conv.window({ maxTurnPairs: 10 });

      const contextIdx = windowed.findIndex(m => (m as any).name === "context");
      const h6Idx = windowed.findIndex(m => m.id === "h6");
      // Context is right before h6
      expect(contextIdx).toBe(h6Idx - 1);
    });

    it("keeps tool groups atomic — never orphans ToolMessages", () => {
      const msgs = [
        ...makeTurnWithTools(1, 3), // Turn 1 with 3 tools (6 messages)
        ...makeSimpleTurns(5, 2),   // Turns 2-6 (simple)
      ];
      const conv = new Conversation(msgs);
      const windowed = conv.window({ maxTurnPairs: 3 });

      // Turn 1 (with tools) should be outside the window entirely
      const toolMsgs = windowed.filter(m => m._getType() === "tool");
      const toolAI = windowed.find(m => m.id === "a1-tc");
      // Either both present (turn was kept) or both absent (turn was dropped)
      if (toolMsgs.length > 0) {
        expect(toolAI).toBeDefined();
      } else {
        expect(toolAI).toBeUndefined();
      }
    });
  });

  // ── charCount ──────────────────────────────────────────────────

  describe("charCount", () => {
    it("counts string content", () => {
      expect(Conversation.charCount(new HumanMessage({ content: "hello" }))).toBe(5);
    });

    it("counts array content text blocks", () => {
      const msg = new HumanMessage({
        content: [
          { type: "text", text: "hello" },
          { type: "text", text: " world" },
        ] as any,
      });
      expect(Conversation.charCount(msg)).toBe(11);
    });

    it("ignores non-text blocks", () => {
      const msg = new HumanMessage({
        content: [
          { type: "text", text: "hello" },
          { type: "image_url", image_url: { url: "data:..." } },
        ] as any,
      });
      expect(Conversation.charCount(msg)).toBe(5);
    });
  });

  // ── Compaction ────────────────────────────────────────────────
  //
  // compact() summarizes old turns, keeping recent ones intact.
  // It produces RemoveMessage entries + a new consolidated summary.
  // Context messages are removed (ephemeral — re-injected each turn).
  // Existing summaries are folded into the new summary (exactly one summary).
  // Tool call groups (AI + ToolMessages) are never split.

  /** Deterministic mock summarizer — no LLM calls. */
  const mockSummarizer = async (messages: BaseMessage[], existingSummaries: string[]) => {
    const parts: string[] = [];
    if (existingSummaries.length > 0) {
      parts.push(`Previous: ${existingSummaries.join("; ")}.`);
    }
    parts.push(`Summarized ${messages.length} messages.`);
    return parts.join(" ");
  };

  /**
   * Apply compaction result through LangGraph's reducer, return new state.
   * First initializes state through the reducer (assigns IDs, like production).
   * Then re-creates the Conversation and compacts against the initialized state.
   */
  async function applyCompactionWithReducer(
    original: BaseMessage[],
    compactOpts: Parameters<Conversation["compact"]>[0],
  ) {
    // Initialize state through reducer (assigns IDs to all messages)
    const initialized = messagesStateReducer([], original);
    // Re-parse and compact the initialized state
    const conv = new Conversation(initialized);
    const result = await conv.compact(compactOpts);
    if (!result) return { after: initialized, result: null };
    // Apply compaction through reducer
    const after = messagesStateReducer(initialized, result.toMessages());
    return { after, result };
  }

  describe("compact", () => {
    it("returns null when under thresholds (no compaction needed)", async () => {
      const msgs = makeSimpleTurns(3);
      const conv = new Conversation(msgs);

      const result = await conv.compact({
        messageThreshold: 10,
        keepRecent: 5,
        summarizer: mockSummarizer,
      });

      expect(result).toBeNull();
    });

    it("triggers when humanTurnCount exceeds messageThreshold", async () => {
      const msgs = makeSimpleTurns(8);
      const conv = new Conversation(msgs);

      const result = await conv.compact({
        messageThreshold: 5,
        keepRecent: 3,
        summarizer: mockSummarizer,
      });

      expect(result).not.toBeNull();
      expect(result!.summary).toBeDefined();
      expect(result!.removals.length).toBeGreaterThan(0);
    });

    it("triggers when totalChars exceeds maxChars", async () => {
      const longContent = "x".repeat(50_000);
      const msgs = [
        new HumanMessage({ content: longContent, id: "h1" }),
        new AIMessage({ content: longContent, id: "a1" }),
        new HumanMessage({ content: "recent", id: "h2" }),
        new AIMessage({ content: "recent reply", id: "a2" }),
      ];
      const conv = new Conversation(msgs);

      const result = await conv.compact({
        messageThreshold: 100, // won't trigger on turns
        maxChars: 40_000,      // will trigger on chars
        keepRecent: 1,
        summarizer: mockSummarizer,
      });

      expect(result).not.toBeNull();
    });

    it("keeps the most recent N turns and summarizes the rest", async () => {
      const msgs = makeSimpleTurns(8);
      const opts = { messageThreshold: 3, keepRecent: 3, summarizer: mockSummarizer };
      const { after } = await applyCompactionWithReducer(msgs, opts);

      // Recent 3 turns (h6-h8) kept, older ones removed
      const keptHumanIds = after
        .filter(m => m._getType() === "human")
        .map(m => m.id);
      expect(keptHumanIds).toContain("h6");
      expect(keptHumanIds).toContain("h7");
      expect(keptHumanIds).toContain("h8");
      expect(keptHumanIds).not.toContain("h1");
      expect(keptHumanIds).not.toContain("h2");
    });

    it("produces exactly one summary message", async () => {
      const msgs = makeSimpleTurns(8);
      const opts = { messageThreshold: 3, keepRecent: 3, summarizer: mockSummarizer };
      const { after } = await applyCompactionWithReducer(msgs, opts);

      const summaries = after.filter(m => isSummaryMessage(m));
      expect(summaries.length).toBe(1);
    });

    it("consolidates existing summaries — folds old summary into new", async () => {
      const oldSummary = makeSummary("Built a landing page with hero section.", "sum-old");
      const msgs = [oldSummary, ...makeSimpleTurns(8)];
      const opts = { messageThreshold: 3, keepRecent: 3, summarizer: mockSummarizer };
      const { after } = await applyCompactionWithReducer(msgs, opts);

      // Old summary removed, new one present
      const summaries = after.filter(m => isSummaryMessage(m));
      expect(summaries.length).toBe(1);
      expect(summaries[0]!.id).not.toBe("sum-old");

      // New summary incorporates old summary text
      const summaryText = summaries[0]!.content as string;
      expect(summaryText).toContain("Previous:");
      expect(summaryText).toContain("Built a landing page with hero section.");
    });

    it("removes context from summarized turns, keeps context in kept turns", async () => {
      const msgs = [
        createContextMessage("brainstorm finished", { timestamp: "2024-01-01" }),
        new HumanMessage({ content: "Build page", id: "h1" }),
        new AIMessage({ content: "Built it", id: "a1" }),
        createContextMessage("old images uploaded", { timestamp: "2024-01-02" }),
        new HumanMessage({ content: "Add images", id: "h2" }),
        new AIMessage({ content: "Added", id: "a2" }),
        // Turns 3-5 get summarized (outside keepRecent: 3)
        ...makeSimpleTurns(3, 3),
        // Turn 6 kept — has context that should survive
        createContextMessage("recent screenshot", { timestamp: "2024-01-10" }),
        new HumanMessage({ content: "Fix the hero", id: "h6" }),
        new AIMessage({ content: "Fixed", id: "a6" }),
        ...makeSimpleTurns(2, 7), // turns 7-8
      ];
      const opts = { messageThreshold: 3, keepRecent: 3, summarizer: mockSummarizer };
      const { after } = await applyCompactionWithReducer(msgs, opts);

      const contextMsgs = after.filter(m =>
        (m as any).name === "context" && !isSummaryMessage(m)
      );

      // Context from summarized turns (1-5) is gone
      // Context in kept turn 6 ("recent screenshot") survives
      expect(contextMsgs.length).toBe(1);
      expect(contextMsgs[0]!.content).toContain("recent screenshot");
    });

    it("keeps tool call groups atomic — never splits AI(tool_calls) from ToolMessages", async () => {
      // Turn 1: simple. Turn 2: has tool calls. Turns 3-6: simple.
      const msgs = [
        new HumanMessage({ content: "Old request", id: "h1" }),
        new AIMessage({ content: "Done 1", id: "a1" }),
        new HumanMessage({ content: "Edit with tools", id: "h2" }),
        new AIMessage({
          content: "Editing...", id: "a2-tc",
          tool_calls: [{ id: "tc1", name: "write", args: {}, type: "tool_call" as const }],
        }),
        new ToolMessage({ content: "Wrote file", tool_call_id: "tc1", id: "t2" }),
        new AIMessage({ content: "Done editing", id: "a2-done" }),
        ...makeSimpleTurns(4, 3), // turns 3-6
      ];
      const conv = new Conversation(msgs);

      const result = await conv.compact({
        messageThreshold: 3,
        keepRecent: 3,
        summarizer: mockSummarizer,
      });

      expect(result).not.toBeNull();

      // Check that tool pair is either both removed or both kept
      const removedIds = new Set(
        result!.removals.map(m => (m as any).id)
      );
      const toolAIRemoved = removedIds.has("a2-tc");
      const toolResultRemoved = removedIds.has("t2");
      expect(toolAIRemoved).toBe(toolResultRemoved);
    });

    it("passes summarized messages to the summarizer function", async () => {
      let capturedMessages: BaseMessage[] = [];
      const capturingSummarizer = async (messages: BaseMessage[], summaries: string[]) => {
        capturedMessages = messages;
        return "Test summary";
      };

      const msgs = makeSimpleTurns(8);
      const conv = new Conversation(msgs);

      await conv.compact({
        messageThreshold: 3,
        keepRecent: 3,
        summarizer: capturingSummarizer,
      });

      // Summarizer received the old messages (not the kept ones)
      expect(capturedMessages.length).toBeGreaterThan(0);
      const summarizedIds = capturedMessages.map(m => m.id);
      expect(summarizedIds).toContain("h1"); // old turn
      expect(summarizedIds).not.toContain("h8"); // recent turn
    });

    it("result.toMessages() produces reducer-compatible output", async () => {
      const msgs = makeSimpleTurns(8);
      const conv = new Conversation(msgs);

      const result = await conv.compact({
        messageThreshold: 3,
        keepRecent: 3,
        summarizer: mockSummarizer,
      });

      expect(result).not.toBeNull();

      // toMessages() returns [removals..., summary]
      const output = result!.toMessages();
      const removals = output.filter(m => m instanceof RemoveMessage);
      const nonRemovals = output.filter(m => !(m instanceof RemoveMessage));

      expect(removals.length).toBeGreaterThan(0);
      expect(nonRemovals.length).toBe(1); // just the summary
      expect(isSummaryMessage(nonRemovals[0]!)).toBe(true);
    });

    it("after reducer, re-parsed state is [summary] [recent turns]", async () => {
      const msgs = [
        ...makeTurnWithTools(1, 3), // Turn 1: create flow with 3 tool calls
        ...makeSimpleTurns(7, 2),   // Turns 2-8: edits
      ];
      const opts = { messageThreshold: 3, keepRecent: 3, summarizer: mockSummarizer };
      const { after } = await applyCompactionWithReducer(msgs, opts);

      // Re-parse through Conversation — summary moves to front
      const reparsed = new Conversation(after);

      expect(reparsed.summaryMessages.length).toBe(1);
      expect(isSummaryMessage(reparsed.summaryMessages[0]!)).toBe(true);

      // Only recent turns survive
      expect(reparsed.humanTurnCount).toBe(3);

      // Old tool messages from turn 1 are gone
      const allMsgIds = new Set(reparsed.toMessages().map(m => m.id).filter(Boolean));
      expect(allMsgIds.has("h1")).toBe(false);
      expect(allMsgIds.has("a1-tc")).toBe(false);
    });

    it("second compaction round consolidates — never more than one summary", async () => {
      // Simulate state AFTER a previous compaction: [old-summary, recent turns]
      const msgs = [
        makeSummary("Built a landing page with hero and CTA.", "sum-old"),
        ...makeSimpleTurns(8),
      ];
      const opts = { messageThreshold: 3, keepRecent: 3, summarizer: mockSummarizer };
      const { after } = await applyCompactionWithReducer(msgs, opts);

      // Still exactly ONE summary
      const summaries = after.filter(m => isSummaryMessage(m));
      expect(summaries.length).toBe(1);

      // Old summary ID is gone
      expect(after.find(m => m.id === "sum-old")).toBeUndefined();
    });

    it("summary includes a timestamp for prepareTurn's event-fetching", async () => {
      const msgs = makeSimpleTurns(8);
      const conv = new Conversation(msgs);

      const before = new Date();
      const result = await conv.compact({
        messageThreshold: 3,
        keepRecent: 3,
        summarizer: mockSummarizer,
      });

      expect(result).not.toBeNull();
      const timestamp = result!.summary.additional_kwargs?.timestamp as string;
      expect(timestamp).toBeDefined();

      // Timestamp should be recent (within the last few seconds)
      const parsed = new Date(timestamp);
      expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(parsed.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  // ── prepareTurn ──────────────────────────────────────────────
  //
  // prepareTurn() combines context injection with windowing.
  // Takes new context events and produces a windowed message array
  // ready for the LLM, with context in the right timeline position.

  describe("prepareTurn", () => {
    it("returns windowed messages when no new context", () => {
      const msgs = makeSimpleTurns(3);
      const conv = new Conversation(msgs);

      const result = conv.prepareTurn();

      expect(result.length).toBe(6); // 3 turns × 2 messages
    });

    it("injects new context events before the last user message", () => {
      const msgs = [
        ...makeSimpleTurns(2),
        new HumanMessage({ content: "Use my images", id: "h3" }),
      ];
      const conv = new Conversation(msgs);

      const ctx = [
        createContextMessage("3 images uploaded"),
        createContextMessage("brainstorm updated"),
      ];
      const result = conv.prepareTurn({ contextMessages: ctx });

      // Context should appear right before h3
      const h3Idx = result.findIndex(m => m.id === "h3");
      expect(h3Idx).toBeGreaterThan(1);
      expect((result[h3Idx - 1] as any).name).toBe("context");
      expect((result[h3Idx - 2] as any).name).toBe("context");
    });

    it("respects maxTurnPairs limit", () => {
      const msgs = makeSimpleTurns(15);
      const conv = new Conversation(msgs);

      const result = conv.prepareTurn({ maxTurnPairs: 3 });

      const humanIds = result
        .filter(m => m._getType() === "human")
        .map(m => m.id);
      expect(humanIds.length).toBe(3);
      expect(humanIds).toContain("h15");
    });

    it("respects maxChars limit", () => {
      const longContent = "x".repeat(15_000);
      const msgs = [
        new HumanMessage({ content: longContent, id: "h1" }),
        new AIMessage({ content: longContent, id: "a1" }),
        new HumanMessage({ content: longContent, id: "h2" }),
        new AIMessage({ content: longContent, id: "a2" }),
        new HumanMessage({ content: "recent", id: "h3" }),
        new AIMessage({ content: "recent reply", id: "a3" }),
      ];
      const conv = new Conversation(msgs);

      const result = conv.prepareTurn({ maxChars: 40_000 });

      expect(result.length).toBeLessThan(6);
      expect(result.map(m => m.id)).toContain("a3");
    });

    it("preserves summary messages at the front", () => {
      const summary = makeSummary("Built a page.", "sum1");
      const msgs = [summary, ...makeSimpleTurns(3)];
      const conv = new Conversation(msgs);

      const result = conv.prepareTurn();

      expect(result[0]!.id).toBe("sum1");
      expect((result[0] as any).content).toContain("[[[CONVERSATION SUMMARY]]]");
    });

    it("combines context injection with windowing", () => {
      // 15 turns, window to 3, inject new context
      const msgs = makeSimpleTurns(15);
      const conv = new Conversation(msgs);

      const ctx = [createContextMessage("new event")];
      const result = conv.prepareTurn({
        contextMessages: ctx,
        maxTurnPairs: 3,
      });

      // Only 3 turns kept
      const humanIds = result
        .filter(m => m._getType() === "human" && (m as any).name !== "context")
        .map(m => m.id);
      expect(humanIds.length).toBe(3);

      // Context is injected before the last human message
      let lastHumanIdx = -1;
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i]!._getType() === "human" && (result[i] as any).name !== "context") {
          lastHumanIdx = i;
          break;
        }
      }
      expect((result[lastHumanIdx - 1] as any).name).toBe("context");
    });

    it("handles create flow — no existing turns, just context", () => {
      const conv = new Conversation([]);

      const ctx = [
        createContextMessage("brainstorm: fitness app for busy parents"),
        createContextMessage("Create a landing page for this business"),
      ];
      const result = conv.prepareTurn({ contextMessages: ctx });

      // Just the context messages
      expect(result.length).toBe(2);
      expect((result[0] as any).name).toBe("context");
      expect((result[1] as any).name).toBe("context");
    });

    // ── Isolation: prepareTurn must never mutate input ──────────

    it("returns a new array, never same reference as input", () => {
      const msgs = makeSimpleTurns(3);
      const conv = new Conversation(msgs);

      const result = conv.prepareTurn();

      expect(result).not.toBe(msgs);
      expect(result).not.toBe(conv.messages);
    });

    it("does not modify the original messages array", () => {
      const msgs = makeSimpleTurns(3);
      const snapshot = JSON.stringify(msgs.map(m => ({ id: m.id, content: m.content })));
      const conv = new Conversation(msgs);

      conv.prepareTurn({
        contextMessages: [createContextMessage("injected context")],
      });

      const afterSnapshot = JSON.stringify(msgs.map(m => ({ id: m.id, content: m.content })));
      expect(afterSnapshot).toBe(snapshot);
    });

    it("does not modify individual message objects", () => {
      const msgs = makeSimpleTurns(3);
      const firstMsg = msgs[0]!;
      const originalContent = firstMsg.content;
      const originalId = firstMsg.id;
      const conv = new Conversation(msgs);

      conv.prepareTurn({
        contextMessages: [createContextMessage("injected")],
        maxTurnPairs: 2,
      });

      // Original message object unchanged
      expect(firstMsg.content).toBe(originalContent);
      expect(firstMsg.id).toBe(originalId);
    });

    it("context injection does not add to original array", () => {
      const msgs = makeSimpleTurns(3);
      const originalLength = msgs.length;
      const conv = new Conversation(msgs);

      conv.prepareTurn({
        contextMessages: [
          createContextMessage("ctx1"),
          createContextMessage("ctx2"),
        ],
      });

      expect(msgs.length).toBe(originalLength);
    });
  });

  // ── Compact edge cases ──────────────────────────────────────

  describe("tool result clearing", () => {
    it("clears large tool results before passing to summarizer", async () => {
      const largeResult = "x".repeat(1000);
      const msgs: BaseMessage[] = [
        new HumanMessage({ content: "Build page", id: "h1" }),
        new AIMessage({
          content: "Building...", id: "a1-tc",
          tool_calls: [{ id: "tc1", name: "write_file", args: {}, type: "tool_call" as const }],
        }),
        new ToolMessage({ content: largeResult, tool_call_id: "tc1", id: "t1" }),
        new AIMessage({ content: "Done", id: "a1-done" }),
        ...makeSimpleTurns(5, 2), // turns 2-6: enough to trigger compaction
      ];

      let capturedMessages: BaseMessage[] = [];
      const capturingSummarizer = async (messages: BaseMessage[], _summaries: string[]) => {
        capturedMessages = messages;
        return "Test summary";
      };

      const conv = new Conversation(msgs);
      await conv.compact({
        messageThreshold: 3,
        keepRecent: 3,
        summarizer: capturingSummarizer,
        toolResultMaxChars: 500,
      });

      // The tool result in summarizer input should be truncated
      const toolMsg = capturedMessages.find(m => m._getType() === "tool");
      expect(toolMsg).toBeDefined();
      const content = typeof toolMsg!.content === "string" ? toolMsg!.content : "";
      expect(content.length).toBeLessThan(largeResult.length);
      expect(content).toContain("cleared");
    });

    it("preserves small tool results", async () => {
      const smallResult = "File written successfully.";
      const msgs: BaseMessage[] = [
        new HumanMessage({ content: "Build page", id: "h1" }),
        new AIMessage({
          content: "Building...", id: "a1-tc",
          tool_calls: [{ id: "tc1", name: "write_file", args: {}, type: "tool_call" as const }],
        }),
        new ToolMessage({ content: smallResult, tool_call_id: "tc1", id: "t1" }),
        new AIMessage({ content: "Done", id: "a1-done" }),
        ...makeSimpleTurns(5, 2),
      ];

      let capturedMessages: BaseMessage[] = [];
      const capturingSummarizer = async (messages: BaseMessage[], _summaries: string[]) => {
        capturedMessages = messages;
        return "Test summary";
      };

      const conv = new Conversation(msgs);
      await conv.compact({
        messageThreshold: 3,
        keepRecent: 3,
        summarizer: capturingSummarizer,
        toolResultMaxChars: 500,
      });

      // Small tool result should be preserved as-is
      const toolMsg = capturedMessages.find(m => m._getType() === "tool");
      expect(toolMsg).toBeDefined();
      expect(toolMsg!.content).toBe(smallResult);
    });

    it("preserves tool_call_id on cleared messages", async () => {
      const largeResult = "x".repeat(1000);
      const msgs: BaseMessage[] = [
        new HumanMessage({ content: "Build page", id: "h1" }),
        new AIMessage({
          content: "Building...", id: "a1-tc",
          tool_calls: [{ id: "tc1", name: "write_file", args: {}, type: "tool_call" as const }],
        }),
        new ToolMessage({ content: largeResult, tool_call_id: "tc1", id: "t1" }),
        new AIMessage({ content: "Done", id: "a1-done" }),
        ...makeSimpleTurns(5, 2),
      ];

      let capturedMessages: BaseMessage[] = [];
      const capturingSummarizer = async (messages: BaseMessage[], _summaries: string[]) => {
        capturedMessages = messages;
        return "Test summary";
      };

      const conv = new Conversation(msgs);
      await conv.compact({
        messageThreshold: 3,
        keepRecent: 3,
        summarizer: capturingSummarizer,
        toolResultMaxChars: 500,
      });

      const toolMsg = capturedMessages.find(m => m._getType() === "tool") as ToolMessage;
      expect(toolMsg).toBeDefined();
      expect(toolMsg.tool_call_id).toBe("tc1");
    });

    it("does not affect messages in kept turns", async () => {
      const largeResult = "x".repeat(1000);
      const msgs: BaseMessage[] = [
        ...makeSimpleTurns(5, 1), // turns 1-5: get summarized
        // Turn 6: kept, has large tool result
        new HumanMessage({ content: "Latest edit", id: "h6" }),
        new AIMessage({
          content: "Working...", id: "a6-tc",
          tool_calls: [{ id: "tc6", name: "write_file", args: {}, type: "tool_call" as const }],
        }),
        new ToolMessage({ content: largeResult, tool_call_id: "tc6", id: "t6" }),
        new AIMessage({ content: "Done", id: "a6-done" }),
      ];

      const conv = new Conversation(msgs);
      const result = await conv.compact({
        messageThreshold: 3,
        keepRecent: 1,
        summarizer: mockSummarizer,
        toolResultMaxChars: 500,
      });

      expect(result).not.toBeNull();
      // The kept turn's tool result should NOT be in removals
      const removedIds = new Set(result!.removals.map(m => (m as any).id));
      expect(removedIds.has("t6")).toBe(false);
    });

    it("defaults to 500 char threshold when toolResultMaxChars not specified", async () => {
      const justOver = "x".repeat(501);
      const justUnder = "y".repeat(499);
      const msgs: BaseMessage[] = [
        new HumanMessage({ content: "Build page", id: "h1" }),
        new AIMessage({
          content: "Building...", id: "a1-tc",
          tool_calls: [
            { id: "tc1", name: "tool1", args: {}, type: "tool_call" as const },
            { id: "tc2", name: "tool2", args: {}, type: "tool_call" as const },
          ],
        }),
        new ToolMessage({ content: justOver, tool_call_id: "tc1", id: "t1" }),
        new ToolMessage({ content: justUnder, tool_call_id: "tc2", id: "t2" }),
        new AIMessage({ content: "Done", id: "a1-done" }),
        ...makeSimpleTurns(5, 2),
      ];

      let capturedMessages: BaseMessage[] = [];
      const capturingSummarizer = async (messages: BaseMessage[], _summaries: string[]) => {
        capturedMessages = messages;
        return "Test summary";
      };

      const conv = new Conversation(msgs);
      await conv.compact({
        messageThreshold: 3,
        keepRecent: 3,
        summarizer: capturingSummarizer,
        // no toolResultMaxChars — should default to 500
      });

      const toolMsgs = capturedMessages.filter(m => m._getType() === "tool");
      expect(toolMsgs.length).toBe(2);

      // Over 500: cleared
      const t1 = toolMsgs.find(m => (m as ToolMessage).tool_call_id === "tc1");
      expect(typeof t1!.content === "string" && t1!.content.includes("cleared")).toBe(true);

      // Under 500: preserved
      const t2 = toolMsgs.find(m => (m as ToolMessage).tool_call_id === "tc2");
      expect(t2!.content).toBe(justUnder);
    });
  });

  describe("compact edge cases", () => {
    it("RemoveMessage targeting nonexistent ID throws (characterization)", () => {
      const msgs = makeSimpleTurns(3);
      const initialized = messagesStateReducer([], msgs);
      const bogusRemoval = new RemoveMessage({ id: "does-not-exist" });

      // LangGraph's messagesStateReducer throws on removal of nonexistent IDs.
      // This is important: compaction must only emit RemoveMessages for IDs
      // that actually exist in the current state.
      expect(() => messagesStateReducer(initialized, [bogusRemoval])).toThrow();
    });

    it("back-to-back compaction without new messages returns null", async () => {
      const msgs = makeSimpleTurns(8);
      const opts = { messageThreshold: 3, keepRecent: 3, summarizer: mockSummarizer };
      const { after } = await applyCompactionWithReducer(msgs, opts);

      // Compact again immediately — should be under thresholds now
      const conv2 = new Conversation(after);
      const result2 = await conv2.compact(opts);

      expect(result2).toBeNull();
    });

    it("compact with context-only messages (no human turns) returns null", async () => {
      const msgs = [
        createContextMessage("brainstorm context"),
        createContextMessage("image context"),
      ];
      const conv = new Conversation(msgs);

      const result = await conv.compact({
        messageThreshold: 3,
        keepRecent: 3,
        summarizer: mockSummarizer,
      });

      expect(result).toBeNull();
    });
  });
});
