/**
 * Unit tests for compactConversation.
 *
 * Tests the compaction logic with mock LLM — no real API calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HumanMessage, AIMessage, RemoveMessage } from "@langchain/core/messages";
import { createContextMessage } from "langgraph-ai-sdk";
import { compactConversation } from "@nodes";

// Mock getLLM to avoid real API calls
vi.mock("@core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@core")>();
  return {
    ...original,
    getLLM: vi.fn().mockResolvedValue({
      invoke: vi.fn().mockResolvedValue({
        content: "User changed hero headline and updated colors to blue.",
      }),
    }),
  };
});

function makeMessages(count: number, startId = 1) {
  const msgs = [];
  for (let i = 0; i < count; i++) {
    const id = `msg-${startId + i}`;
    if (i % 2 === 0) {
      msgs.push(new HumanMessage({ content: `User message ${i + 1}`, id }));
    } else {
      msgs.push(new AIMessage({ content: `AI response ${i + 1}`, id }));
    }
  }
  return msgs;
}

describe("compactConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty object when below message threshold", async () => {
    const messages = makeMessages(10); // 10 < 12
    const result = await compactConversation(messages);
    expect(result).toEqual({});
  });

  it("returns empty object when messages is empty", async () => {
    const result = await compactConversation([]);
    expect(result).toEqual({});
  });

  it("triggers compaction when message count exceeds threshold", async () => {
    const messages = makeMessages(14); // 14 > 12
    const result = await compactConversation(messages);

    expect(result).toHaveProperty("messages");
    const resultMessages = (result as { messages: any[] }).messages;

    // Should have RemoveMessages for old messages (14 - 6 = 8 removals)
    const removals = resultMessages.filter(
      (m: any) => m instanceof RemoveMessage
    );
    expect(removals.length).toBe(8);

    // Should have a summary message
    const summaryMsg = resultMessages.find(
      (m: any) => typeof m.content === "string" && m.content.includes("[Conversation Summary]")
    );
    expect(summaryMsg).toBeDefined();
    expect((summaryMsg as any).name).toBe("context");
  });

  it("keeps the last N messages (default 6)", async () => {
    const messages = makeMessages(14);
    const result = await compactConversation(messages);
    const resultMessages = (result as { messages: any[] }).messages;

    // Removed IDs should be msg-1 through msg-8
    const removedIds = resultMessages
      .filter((m: any) => m instanceof RemoveMessage)
      .map((m: any) => m.id);

    for (let i = 1; i <= 8; i++) {
      expect(removedIds).toContain(`msg-${i}`);
    }

    // msg-9 through msg-14 should NOT be removed
    for (let i = 9; i <= 14; i++) {
      expect(removedIds).not.toContain(`msg-${i}`);
    }
  });

  it("removes context messages (they'll be re-injected)", async () => {
    const contextMsg = createContextMessage("brainstorm context");
    (contextMsg as any).id = "ctx-1";
    const messages = [...[contextMsg], ...makeMessages(14)];

    const result = await compactConversation(messages);
    const resultMessages = (result as { messages: any[] }).messages;

    const removedIds = resultMessages
      .filter((m: any) => m instanceof RemoveMessage)
      .map((m: any) => m.id);

    expect(removedIds).toContain("ctx-1");
  });

  it("respects custom options", async () => {
    const messages = makeMessages(8);
    // With threshold of 6, this should trigger compaction
    const result = await compactConversation(messages, {
      messageThreshold: 6,
      keepRecent: 4,
    });

    expect(result).toHaveProperty("messages");
    const resultMessages = (result as { messages: any[] }).messages;

    // 8 messages, keep 4, so 4 removals
    const removals = resultMessages.filter(
      (m: any) => m instanceof RemoveMessage
    );
    expect(removals.length).toBe(4);
  });

  it("triggers compaction when maxChars is exceeded", async () => {
    // Create a few messages with very long content
    const longContent = "x".repeat(60_000);
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

    // 8 messages but >100K chars, should trigger
    const result = await compactConversation(messages);
    expect(result).toHaveProperty("messages");
  });

  it("returns empty when all messages would be kept", async () => {
    // 14 messages but keepRecent=14 means nothing to summarize
    const messages = makeMessages(14);
    const result = await compactConversation(messages, {
      messageThreshold: 12,
      keepRecent: 14,
    });
    expect(result).toEqual({});
  });

  it("summary message is marked as context", async () => {
    const messages = makeMessages(14);
    const result = await compactConversation(messages);
    const resultMessages = (result as { messages: any[] }).messages;

    const summaryMsg = resultMessages.find(
      (m: any) => !(m instanceof RemoveMessage)
    );
    expect(summaryMsg).toBeDefined();
    expect((summaryMsg as any).name).toBe("context");
    expect((summaryMsg as any).content).toContain("[Conversation Summary]");
  });
});
