/**
 * Unit tests for compactConversation.
 *
 * Tests the compaction logic with mock LLM — no real API calls.
 *
 * Threshold and keepRecent count HUMAN TURNS (non-context HumanMessages),
 * not raw message count. Tool calls and AI responses bundled with their
 * human turn are kept/removed as a unit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HumanMessage, AIMessage, ToolMessage, RemoveMessage } from "@langchain/core/messages";
import { createContextMessage } from "langgraph-ai-sdk";
import { compactConversation } from "@nodes";

// Mock getLLM to avoid real API calls
vi.mock("@core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@core")>();
  return {
    ...original,
    getLLM: vi.fn().mockResolvedValue({
      invoke: vi.fn().mockResolvedValue({
        content: "The user changed hero headline and updated colors to blue.",
      }),
    }),
  };
});

/** Creates N human+AI pairs (2N raw messages). */
function makeMessages(humanCount: number, startId = 1) {
  const msgs = [];
  for (let i = 0; i < humanCount; i++) {
    const hId = `msg-h${startId + i}`;
    const aId = `msg-a${startId + i}`;
    msgs.push(new HumanMessage({ content: `User message ${i + 1}`, id: hId }));
    msgs.push(new AIMessage({ content: `AI response ${i + 1}`, id: aId }));
  }
  return msgs;
}

/** Creates a human turn with an AI tool-call exchange (human → AI+tools → ToolMsg × N → AI final). */
function makeTurnWithTools(turnIndex: number, toolCount = 2) {
  const msgs: any[] = [];
  msgs.push(new HumanMessage({ content: `User turn ${turnIndex}`, id: `turn-h${turnIndex}` }));
  // AI with tool_calls
  msgs.push(new AIMessage({
    content: "",
    id: `turn-ai-tc${turnIndex}`,
    tool_calls: Array.from({ length: toolCount }, (_, j) => ({
      id: `tc-${turnIndex}-${j}`,
      name: `tool_${j}`,
      args: {},
    })),
  }));
  // ToolMessages
  for (let j = 0; j < toolCount; j++) {
    msgs.push(new ToolMessage({
      content: `Tool result ${j}`,
      id: `turn-tm${turnIndex}-${j}`,
      tool_call_id: `tc-${turnIndex}-${j}`,
    }));
  }
  // Final AI response
  msgs.push(new AIMessage({ content: `AI final ${turnIndex}`, id: `turn-af${turnIndex}` }));
  return msgs;
}

describe("compactConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty object when below threshold (default 30 human turns)", async () => {
    // 25 human turns × 2 msgs each = 50 raw messages, but only 25 human turns < 30
    const messages = makeMessages(25);
    const result = await compactConversation(messages);
    expect(result).toEqual({});
  });

  it("returns empty object when messages is empty", async () => {
    const result = await compactConversation([]);
    expect(result).toEqual({});
  });

  it("triggers compaction when human turns exceed threshold", async () => {
    // 35 human turns > 30 default threshold
    const messages = makeMessages(35);
    const result = await compactConversation(messages);

    expect(result).toHaveProperty("messages");
    const resultMessages = (result as { messages: any[] }).messages;

    // Should have a summary message
    const summaryMsg = resultMessages.find(
      (m: any) => typeof m.content === "string" && m.content.includes("[Conversation Summary]")
    );
    expect(summaryMsg).toBeDefined();
    expect((summaryMsg as any).name).toBe("context");
  });

  it("keeps last 20 human turns by default (and their associated messages)", async () => {
    // 35 turns. Should keep last 20 turns = turns 16-35.
    // Summarize first 15 turns = turns 1-15.
    const messages = makeMessages(35);
    const result = await compactConversation(messages);
    const resultMessages = (result as { messages: any[] }).messages;

    const removedIds = resultMessages
      .filter((m: any) => m instanceof RemoveMessage)
      .map((m: any) => m.id);

    // First 15 turns removed (human + AI for each = 30 messages)
    for (let i = 1; i <= 15; i++) {
      expect(removedIds).toContain(`msg-h${i}`);
      expect(removedIds).toContain(`msg-a${i}`);
    }

    // Last 20 turns kept (turns 16-35)
    for (let i = 16; i <= 35; i++) {
      expect(removedIds).not.toContain(`msg-h${i}`);
      expect(removedIds).not.toContain(`msg-a${i}`);
    }
  });

  it("tool messages don't count toward human turn threshold", async () => {
    // 10 turns with 3 tool calls each = 10 human + 10 AI(tc) + 30 tool + 10 AI(final) = 60 raw msgs
    // But only 10 human turns < 30 threshold — should NOT compact
    const messages = [];
    for (let i = 1; i <= 10; i++) {
      messages.push(...makeTurnWithTools(i, 3));
    }
    const result = await compactConversation(messages);
    expect(result).toEqual({});
  });

  it("keeps tool calls bundled with their human turn", async () => {
    // 8 turns with 2 tool calls each, threshold=5, keepRecent=3
    // Each turn: human + AI(tc) + 2 tool + AI(final) = 5 msgs
    // Should keep last 3 human turns = 15 raw messages
    // Should remove first 5 human turns = 25 raw messages
    const messages = [];
    for (let i = 1; i <= 8; i++) {
      messages.push(...makeTurnWithTools(i, 2));
    }

    const result = await compactConversation(messages, {
      messageThreshold: 5,
      keepRecent: 3,
    });

    expect(result).toHaveProperty("messages");
    const resultMessages = (result as { messages: any[] }).messages;

    const removedIds = resultMessages
      .filter((m: any) => m instanceof RemoveMessage)
      .map((m: any) => m.id);

    // First 5 turns should be removed (turns 1-5)
    for (let i = 1; i <= 5; i++) {
      expect(removedIds).toContain(`turn-h${i}`);
      expect(removedIds).toContain(`turn-ai-tc${i}`);
      expect(removedIds).toContain(`turn-af${i}`);
    }

    // Last 3 turns should be kept (turns 6-8)
    for (let i = 6; i <= 8; i++) {
      expect(removedIds).not.toContain(`turn-h${i}`);
      expect(removedIds).not.toContain(`turn-af${i}`);
    }
  });

  it("removes context messages (they'll be re-injected)", async () => {
    const contextMsg = createContextMessage("brainstorm context");
    (contextMsg as any).id = "ctx-1";
    const messages = [...[contextMsg], ...makeMessages(35)];

    const result = await compactConversation(messages);
    const resultMessages = (result as { messages: any[] }).messages;

    const removedIds = resultMessages
      .filter((m: any) => m instanceof RemoveMessage)
      .map((m: any) => m.id);

    expect(removedIds).toContain("ctx-1");
  });

  it("respects custom threshold and keepRecent", async () => {
    // 8 human turns, threshold=5, keepRecent=3
    const messages = makeMessages(8);
    const result = await compactConversation(messages, {
      messageThreshold: 5,
      keepRecent: 3,
    });

    expect(result).toHaveProperty("messages");
    const resultMessages = (result as { messages: any[] }).messages;

    // 8 turns - keep 3 = 5 turns summarized = 10 raw messages removed
    const removals = resultMessages.filter(
      (m: any) => m instanceof RemoveMessage
    );
    expect(removals.length).toBe(10);
  });

  it("triggers compaction when maxChars is exceeded", async () => {
    const longContent = "x".repeat(100_000);
    const messages = [
      new HumanMessage({ content: longContent, id: "long-1" }),
      new AIMessage({ content: "short reply", id: "long-2" }),
      new HumanMessage({ content: longContent, id: "long-3" }),
      new AIMessage({ content: "short reply 2", id: "long-4" }),
      new HumanMessage({ content: "final msg", id: "long-5" }),
      new AIMessage({ content: "final reply", id: "long-6" }),
      new HumanMessage({ content: "latest", id: "long-7" }),
      new AIMessage({ content: "latest reply", id: "long-8" }),
    ];

    // 4 human turns < 30 threshold, but >200K chars exceeds maxChars
    // Use keepRecent=2 so there are turns to summarize
    const result = await compactConversation(messages, { keepRecent: 2 });
    expect(result).toHaveProperty("messages");

    const resultMessages = (result as { messages: any[] }).messages;
    const removals = resultMessages.filter((m: any) => m instanceof RemoveMessage);
    // Keep last 2 human turns (long-5..long-8), remove first 2 (long-1..long-4)
    expect(removals.length).toBe(4);
  });

  it("returns empty when all turns would be kept", async () => {
    // 8 human turns, keepRecent=10 (more than we have)
    const messages = makeMessages(8);
    const result = await compactConversation(messages, {
      messageThreshold: 5,
      keepRecent: 10,
    });
    expect(result).toEqual({});
  });

  it("summary message is marked as context AIMessage", async () => {
    const messages = makeMessages(35);
    const result = await compactConversation(messages);
    const resultMessages = (result as { messages: any[] }).messages;

    const summaryMsg = resultMessages.find(
      (m: any) => !(m instanceof RemoveMessage)
    );
    expect(summaryMsg).toBeDefined();
    expect((summaryMsg as any).name).toBe("context");
    expect((summaryMsg as any).content).toContain("[Conversation Summary]");
    expect(summaryMsg).toBeInstanceOf(AIMessage);
    expect(summaryMsg).not.toBeInstanceOf(HumanMessage);
  });
});
