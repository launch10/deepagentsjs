/**
 * Tests for startConversation / Conversation.start()
 *
 * Verifies the canonical agent turn lifecycle:
 * - Context injection ordering (context before human message)
 * - Windowing (respects maxTurnPairs/maxChars)
 * - Compaction (triggers when thresholds exceeded, returns removals + summary)
 * - Context isolation across turns (no leakage)
 * - Agent result passthrough (extra properties preserved)
 * - Compact disabled behavior
 *
 * Uses mock summarizer — no LLM calls.
 */
import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage, RemoveMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { createContextMessage, isContextMessage, isSummaryMessage } from "langgraph-ai-sdk";
import { Conversation, startConversation } from "@conversation";
import { makeSimpleTurns, mockSummarizer, tagMessage } from "@support";

// ============================================================================
// HELPERS
// ============================================================================

/** Count messages of a given tag type */
function countByTag(msgs: BaseMessage[], tag: string): number {
  return msgs.filter((m) => tagMessage(m) === tag).length;
}

/** Find index of last message with a given tag */
function lastIndexOfTag(msgs: BaseMessage[], tag: string): number {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (tagMessage(msgs[i]!) === tag) return i;
  }
  return -1;
}

/**
 * Simulate the LangGraph reducer including reconcileOrdering.
 *
 * reconcileOrdering detects existing messages that appear after new messages
 * in the update and removes them so they get re-added in the new position.
 * This mirrors the real timestampedMessagesReducer in base.ts.
 */
function simulateReducer(state: BaseMessage[], updates: BaseMessage[]): BaseMessage[] {
  const stateIds = new Set(state.map((m) => m.id).filter((id): id is string => !!id));

  // Detect messages needing repositioning (reconcileOrdering logic)
  let sawNew = false;
  const toReposition = new Set<string>();
  for (const msg of updates) {
    if (msg instanceof RemoveMessage) continue;
    if (!msg.id || !stateIds.has(msg.id)) {
      sawNew = true;
    } else if (sawNew) {
      toReposition.add(msg.id);
    }
  }

  // Remove repositioned messages from state
  let result = state.filter((m) => !m.id || !toReposition.has(m.id));

  // Apply updates: RemoveMessages remove, others append
  for (const msg of updates) {
    if (msg instanceof RemoveMessage) {
      result = result.filter((m) => m.id !== msg.id);
    } else {
      result.push(msg);
    }
  }
  return result;
}

// ============================================================================
// TESTS
// ============================================================================

describe("startConversation", () => {
  // ── Context Injection ──────────────────────────────────────────

  describe("context injection", () => {
    it("injects context before the last human message in prepared input", async () => {
      const messages = [
        new HumanMessage({ content: "Build my page", id: "h1" }),
        new AIMessage({ content: "Done", id: "a1" }),
        new HumanMessage({ content: "Add a hero", id: "h2" }),
      ];

      const ctx = createContextMessage("[Build Errors] fix CSS");

      let capturedPrepared: BaseMessage[] = [];
      await startConversation(
        {
          messages,
          extraContext: [ctx],
          compact: false,
        },
        async (prepared) => {
          capturedPrepared = prepared;
          return { messages: [new AIMessage({ content: "Fixed" })] };
        }
      );

      // In prepared messages, context should be before the last human message
      const tags = capturedPrepared.map(tagMessage);
      const lastHumanIdx = lastIndexOfTag(capturedPrepared, "HUMAN");

      expect(lastHumanIdx).toBeGreaterThan(0);
      expect(tags[lastHumanIdx - 1]).toBe("CTX");
    });

    it("appends context at end for intent-driven turns (last message is AI)", async () => {
      const messages = [
        new HumanMessage({ content: "Build my page", id: "h1" }),
        new AIMessage({ content: "Done", id: "a1" }),
      ];

      const ctx = createContextMessage("[Mode switch] entering help mode");

      let capturedPrepared: BaseMessage[] = [];
      await startConversation(
        {
          messages,
          extraContext: [ctx],
          compact: false,
        },
        async (prepared) => {
          capturedPrepared = prepared;
          return { messages: [new AIMessage({ content: "Helping" })] };
        }
      );

      // Context should be at the end (after AI, since this is intent-driven)
      const tags = capturedPrepared.map(tagMessage);
      expect(tags[tags.length - 1]).toBe("CTX");
    });

    it("returns context + human + agent messages when last is human", async () => {
      const messages = [new HumanMessage({ content: "Build my page", id: "h1" })];

      const ctx = createContextMessage("[Build Errors] fix CSS");
      const aiMsg = new AIMessage({ content: "Fixed" });

      const result = await startConversation(
        {
          messages,
          extraContext: [ctx],
          compact: false,
        },
        async () => ({ messages: [aiMsg] })
      );

      // Return should be: [context, HumanMessage(h1), aiMsg]
      // The reducer's reconcileOrdering auto-creates RemoveMessage for h1
      // since it appears after a new message (context).
      expect(result.messages.length).toBe(3);
      expect(isContextMessage(result.messages[0]!)).toBe(true);
      expect(result.messages[1]!._getType()).toBe("human");
      expect(result.messages[1]!.content).toBe("Build my page");
      expect(result.messages[2]).toBe(aiMsg);
    });

    it("works with no context (empty extraContext)", async () => {
      const messages = [new HumanMessage({ content: "Build my page", id: "h1" })];
      const aiMsg = new AIMessage({ content: "Built it" });

      const result = await startConversation(
        {
          messages,
          extraContext: [],
          compact: false,
        },
        async () => ({ messages: [aiMsg] })
      );

      // Return should be just the agent message
      expect(result.messages.length).toBe(1);
      expect(result.messages[0]).toBe(aiMsg);
    });

    it("works with multiple context messages", async () => {
      const messages = [new HumanMessage({ content: "Fix bugs", id: "h1" })];

      const ctx1 = createContextMessage("[Build Errors] CSS issue");
      const ctx2 = createContextMessage("[Context] User uploaded hero.jpg");
      const aiMsg = new AIMessage({ content: "Fixed both" });

      const result = await startConversation(
        {
          messages,
          extraContext: [ctx1, ctx2],
          compact: false,
        },
        async () => ({ messages: [aiMsg] })
      );

      // Return should be: [ctx1, ctx2, HumanMessage(h1), aiMsg]
      expect(result.messages.length).toBe(4);
      expect(isContextMessage(result.messages[0]!)).toBe(true);
      expect(isContextMessage(result.messages[1]!)).toBe(true);
      expect(result.messages[2]!._getType()).toBe("human");
      expect(result.messages[3]).toBe(aiMsg);
    });
  });

  // ── Windowing ──────────────────────────────────────────────────

  describe("windowing", () => {
    it("respects maxTurnPairs in prepared messages", async () => {
      // Build 20 turns, limit to 3
      const messages = [
        ...makeSimpleTurns(20),
        new HumanMessage({ content: "Latest edit", id: "h-latest" }),
      ];

      let capturedPrepared: BaseMessage[] = [];
      await startConversation(
        {
          messages,
          maxTurnPairs: 3,
          compact: false,
        },
        async (prepared) => {
          capturedPrepared = prepared;
          return { messages: [new AIMessage({ content: "Done" })] };
        }
      );

      // Should have at most 3 turns worth of human messages
      const humanCount = capturedPrepared.filter(
        (m) => m._getType() === "human" && !isContextMessage(m)
      ).length;
      expect(humanCount).toBeLessThanOrEqual(3);
    });
  });

  // ── Compaction ─────────────────────────────────────────────────

  describe("compaction", () => {
    it("triggers compaction when turn count exceeds threshold", async () => {
      // Build 35 turns (exceeds default threshold of 30)
      const messages = [
        ...makeSimpleTurns(35),
        new HumanMessage({ content: "One more edit", id: "h-new" }),
      ];

      const result = await startConversation(
        {
          messages,
          compact: { summarizer: mockSummarizer },
        },
        async () => ({
          messages: [new AIMessage({ content: "Done" })],
        })
      );

      // Should have RemoveMessages in the result
      const removals = result.messages.filter((m) => m instanceof RemoveMessage);
      expect(removals.length).toBeGreaterThan(0);

      // Should have exactly one summary message
      const summaries = result.messages.filter(isSummaryMessage);
      expect(summaries.length).toBe(1);

      // Should still have the agent's new AI message
      const aiMessages = result.messages.filter(
        (m) => m._getType() === "ai" && !isSummaryMessage(m)
      );
      expect(aiMessages.length).toBe(1);
      expect(typeof aiMessages[0]!.content === "string" && aiMessages[0]!.content).toBe("Done");
    });

    it("does not compact when below threshold", async () => {
      const messages = [
        ...makeSimpleTurns(5),
        new HumanMessage({ content: "Small edit", id: "h-new" }),
      ];

      const result = await startConversation(
        {
          messages,
          compact: { summarizer: mockSummarizer },
        },
        async () => ({
          messages: [new AIMessage({ content: "Done" })],
        })
      );

      // No RemoveMessages or summaries
      const removals = result.messages.filter((m) => m instanceof RemoveMessage);
      expect(removals.length).toBe(0);

      const summaries = result.messages.filter(isSummaryMessage);
      expect(summaries.length).toBe(0);

      // Just the agent's message
      expect(result.messages.length).toBe(1);
    });

    it("skips compaction when compact is false", async () => {
      const messages = [
        ...makeSimpleTurns(35),
        new HumanMessage({ content: "One more", id: "h-new" }),
      ];

      const result = await startConversation(
        {
          messages,
          compact: false,
        },
        async () => ({
          messages: [new AIMessage({ content: "Done" })],
        })
      );

      // No removals even though we're over threshold
      const removals = result.messages.filter((m) => m instanceof RemoveMessage);
      expect(removals.length).toBe(0);
    });

    it("skips compaction when compact is omitted", async () => {
      const messages = [
        ...makeSimpleTurns(35),
        new HumanMessage({ content: "One more", id: "h-new" }),
      ];

      const result = await startConversation(
        {
          messages,
          // compact: not provided
        },
        async () => ({
          messages: [new AIMessage({ content: "Done" })],
        })
      );

      // No removals
      const removals = result.messages.filter((m) => m instanceof RemoveMessage);
      expect(removals.length).toBe(0);
    });

    it("respects custom compaction thresholds", async () => {
      // 10 turns with low threshold of 5
      const messages = [
        ...makeSimpleTurns(10),
        new HumanMessage({ content: "New edit", id: "h-new" }),
      ];

      const result = await startConversation(
        {
          messages,
          compact: {
            summarizer: mockSummarizer,
            messageThreshold: 5,
            keepRecent: 3,
          },
        },
        async () => ({
          messages: [new AIMessage({ content: "Done" })],
        })
      );

      // Should trigger compaction (10 turns > threshold 5)
      const removals = result.messages.filter((m) => m instanceof RemoveMessage);
      expect(removals.length).toBeGreaterThan(0);

      const summaries = result.messages.filter(isSummaryMessage);
      expect(summaries.length).toBe(1);
    });

    it("includes context messages in return even when compaction triggers", async () => {
      const messages = [
        ...makeSimpleTurns(35),
        new HumanMessage({ content: "Fix the bug", id: "h-new" }),
      ];

      const ctx = createContextMessage("[Build Errors] CSS not found");

      const result = await startConversation(
        {
          messages,
          extraContext: [ctx],
          compact: { summarizer: mockSummarizer },
        },
        async () => ({
          messages: [new AIMessage({ content: "Fixed" })],
        })
      );

      // Should have context message in return (exclude summary, which also has name="context")
      const contextMsgs = result.messages.filter(
        (m) => isContextMessage(m) && !isSummaryMessage(m)
      );
      expect(contextMsgs.length).toBe(1);

      // Plus summary + removals + AI message
      const summaries = result.messages.filter(isSummaryMessage);
      expect(summaries.length).toBe(1);
    });
  });

  // ── Context isolation across turns ─────────────────────────────

  describe("context isolation", () => {
    it("each turn's context stays separate when simulating multi-turn", async () => {
      // Simulate turn 1 with build error context
      let stateMessages: BaseMessage[] = [new HumanMessage({ content: "Build my page", id: "h1" })];

      const turn1Result = await startConversation(
        {
          messages: stateMessages,
          extraContext: [createContextMessage("[Build Errors] CSS issue")],
          compact: false,
        },
        async () => ({
          messages: [new AIMessage({ content: "Fixed CSS", id: "a1" })],
        })
      );

      // Simulate reducer: RemoveMessages remove by id, others append
      stateMessages = simulateReducer(stateMessages, turn1Result.messages);

      // Turn 1 context should be in the conversation (CTX before HUMAN)
      let conv = new Conversation(stateMessages);
      expect(conv.turns.length).toBe(1);
      const turn1Ctx = conv.turns[0]!.filter(isContextMessage);
      expect(turn1Ctx.some((m) => String(m.content).includes("CSS issue"))).toBe(true);

      // Simulate turn 2 with different context
      stateMessages.push(new HumanMessage({ content: "Add hero", id: "h2" }));

      const turn2Result = await startConversation(
        {
          messages: stateMessages,
          extraContext: [createContextMessage("[Context] User uploaded hero.jpg")],
          compact: false,
        },
        async () => ({
          messages: [new AIMessage({ content: "Added hero", id: "a2" })],
        })
      );

      stateMessages = simulateReducer(stateMessages, turn2Result.messages);
      conv = new Conversation(stateMessages);

      expect(conv.turns.length).toBe(2);

      // Turn 1 still has CSS error, NOT hero.jpg
      const t1Ctx = conv.turns[0]!.filter(isContextMessage);
      expect(t1Ctx.some((m) => String(m.content).includes("CSS issue"))).toBe(true);
      expect(t1Ctx.some((m) => String(m.content).includes("hero.jpg"))).toBe(false);

      // Turn 2 has hero.jpg, NOT CSS error
      const t2Ctx = conv.turns[1]!.filter(isContextMessage);
      expect(t2Ctx.some((m) => String(m.content).includes("hero.jpg"))).toBe(true);
      expect(t2Ctx.some((m) => String(m.content).includes("CSS issue"))).toBe(false);
    });
  });

  // ── Agent result passthrough ───────────────────────────────────

  describe("agent result passthrough", () => {
    it("preserves extra properties from agent result", async () => {
      const messages = [new HumanMessage({ content: "Build my page", id: "h1" })];

      const result = await startConversation(
        {
          messages,
          compact: false,
        },
        async () => ({
          messages: [new AIMessage({ content: "Built it" })],
          status: "completed" as const,
          todos: [{ id: "1", content: "Review", status: "pending" }],
          files: { "index.tsx": { content: "<div/>", created_at: "", modified_at: "" } },
        })
      );

      expect(result.status).toBe("completed");
      expect(result.todos).toHaveLength(1);
      expect(result.files).toBeDefined();
    });
  });

  // ── Conversation.start() static method ─────────────────────────

  describe("Conversation.start() static method", () => {
    it("delegates to startConversation correctly", async () => {
      const messages = [new HumanMessage({ content: "Build my page", id: "h1" })];

      const ctx = createContextMessage("[Build Errors] fix CSS");

      const result = await Conversation.start(
        {
          messages,
          extraContext: [ctx],
          compact: false,
        },
        async () => ({
          messages: [new AIMessage({ content: "Fixed" })],
        })
      );

      // [ctx, HumanMessage(h1), AIMessage]
      expect(result.messages.length).toBe(3);
      expect(isContextMessage(result.messages[0]!)).toBe(true);
      expect(result.messages[1]!._getType()).toBe("human");
    });
  });
});
