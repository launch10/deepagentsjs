/**
 * Unit tests for prepareContextWindow.
 *
 * Pure function — no mocks needed, no API calls.
 */
import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createContextMessage } from "langgraph-ai-sdk";
import { prepareContextWindow } from "@nodes";

function makeMessages(count: number) {
  const msgs = [];
  for (let i = 0; i < count; i++) {
    const id = `msg-${i + 1}`;
    if (i % 2 === 0) {
      msgs.push(new HumanMessage({ content: `User message ${i + 1}`, id }));
    } else {
      msgs.push(new AIMessage({ content: `AI response ${i + 1}`, id }));
    }
  }
  return msgs;
}

describe("prepareContextWindow", () => {
  it("returns messages as-is when within limits", () => {
    const messages = makeMessages(10); // 5 turn pairs, under default 10
    const result = prepareContextWindow(messages);
    expect(result).toEqual(messages);
  });

  it("returns messages as-is when empty", () => {
    const result = prepareContextWindow([]);
    expect(result).toEqual([]);
  });

  it("windows messages when turn pairs exceed limit", () => {
    const messages = makeMessages(30); // 15 turn pairs, over default 10
    const result = prepareContextWindow(messages);

    // Should have at most ~20 conversation messages (10 turn pairs)
    const nonContextMessages = result.filter(
      (m) => (m as any).name !== "context"
    );
    expect(nonContextMessages.length).toBeLessThanOrEqual(20);
    expect(nonContextMessages.length).toBeGreaterThan(0);
  });

  it("always preserves context messages", () => {
    const ctx1 = createContextMessage("brainstorm context");
    const ctx2 = createContextMessage("image context");
    const conversation = makeMessages(30);
    const messages = [ctx1, ctx2, ...conversation];

    const result = prepareContextWindow(messages);

    // Context messages should all be present
    const contextInResult = result.filter(
      (m) => (m as any).name === "context"
    );
    expect(contextInResult.length).toBe(2);
  });

  it("keeps most recent messages (not oldest)", () => {
    const messages = makeMessages(30);
    const result = prepareContextWindow(messages, { maxTurnPairs: 3 });

    const nonContextMessages = result.filter(
      (m) => (m as any).name !== "context"
    );

    // Should contain the last messages, not the first
    const lastMsg = nonContextMessages.at(-1);
    expect(lastMsg?.id).toBe("msg-30");
  });

  it("respects maxChars limit", () => {
    const longContent = "x".repeat(15_000);
    const messages = [
      new HumanMessage({ content: longContent, id: "old-1" }),
      new AIMessage({ content: longContent, id: "old-2" }),
      new HumanMessage({ content: longContent, id: "old-3" }),
      new AIMessage({ content: longContent, id: "old-4" }),
      new HumanMessage({ content: "recent", id: "new-1" }),
      new AIMessage({ content: "recent reply", id: "new-2" }),
    ];

    // 60K+ chars total, maxChars=40K should truncate
    const result = prepareContextWindow(messages, { maxChars: 40_000 });

    // Should not include all 6 messages
    const nonContextMessages = result.filter(
      (m) => (m as any).name !== "context"
    );
    expect(nonContextMessages.length).toBeLessThan(6);

    // Should include the most recent messages
    const ids = nonContextMessages.map((m) => m.id);
    expect(ids).toContain("new-2");
  });

  it("handles messages with array content", () => {
    const messages = [
      new HumanMessage({
        content: [{ type: "text", text: "Hello" }] as any,
        id: "arr-1",
      }),
      new AIMessage({ content: "Response", id: "arr-2" }),
    ];

    const result = prepareContextWindow(messages);
    expect(result.length).toBe(2);
  });

  it("uses custom maxTurnPairs option", () => {
    const messages = makeMessages(20); // 10 turn pairs
    const result = prepareContextWindow(messages, { maxTurnPairs: 3 });

    const nonContextMessages = result.filter(
      (m) => (m as any).name !== "context"
    );

    // Should only have roughly 6 messages (3 turn pairs) plus maybe a straggler
    expect(nonContextMessages.length).toBeLessThanOrEqual(7);
  });

  it("context messages + conversation messages fit together", () => {
    const ctx = createContextMessage("important context");
    const conversation = makeMessages(6);
    const messages = [ctx, ...conversation];

    const result = prepareContextWindow(messages, { maxTurnPairs: 10 });

    // All should be preserved since under limits
    expect(result.length).toBe(7);
  });
});
