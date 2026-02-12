/**
 * Tests for timestampedMessagesReducer.
 *
 * Ensures every message flowing through the graph state gets a
 * discoverable timestamp in additional_kwargs.timestamp. This powers
 * the prepareTurn/compact loop: prepareTurn uses findLastAiMessageTime()
 * to scope event fetching, and compact stamps its summary.
 */
import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage, ToolMessage, RemoveMessage } from "@langchain/core/messages";
import { createContextMessage } from "langgraph-ai-sdk";
import { timestampedMessagesReducer } from "@annotation";

describe("timestampedMessagesReducer", () => {
  it("stamps a HumanMessage with a timestamp", () => {
    const result = timestampedMessagesReducer([], [
      new HumanMessage({ content: "hello", id: "h1" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.additional_kwargs?.timestamp).toBeDefined();
    expect(new Date(result[0]!.additional_kwargs!.timestamp as string).getTime()).not.toBeNaN();
  });

  it("stamps an AIMessage with a timestamp", () => {
    const result = timestampedMessagesReducer([], [
      new AIMessage({ content: "hi back", id: "a1" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.additional_kwargs?.timestamp).toBeDefined();
  });

  it("stamps a ToolMessage with a timestamp", () => {
    const result = timestampedMessagesReducer([], [
      new ToolMessage({ content: "tool result", id: "t1", tool_call_id: "tc1" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.additional_kwargs?.timestamp).toBeDefined();
  });

  it("stamps context messages with a timestamp", () => {
    const ctx = createContextMessage("brainstorm context");
    (ctx as any).id = "ctx1";

    const result = timestampedMessagesReducer([], [ctx]);

    expect(result).toHaveLength(1);
    expect(result[0]!.additional_kwargs?.timestamp).toBeDefined();
  });

  it("does not overwrite an existing additional_kwargs.timestamp", () => {
    const existingTimestamp = "2024-06-15T12:00:00.000Z";
    const msg = new HumanMessage({
      content: "hello",
      id: "h1",
      additional_kwargs: { timestamp: existingTimestamp },
    });

    const result = timestampedMessagesReducer([], [msg]);

    expect(result[0]!.additional_kwargs?.timestamp).toBe(existingTimestamp);
  });

  it("does not overwrite an AI message with response_metadata.timestamp", () => {
    const msg = new AIMessage({
      content: "response",
      id: "a1",
      response_metadata: { timestamp: "2024-06-15T12:00:00.000Z" },
    });

    const result = timestampedMessagesReducer([], [msg]);

    // Should NOT have added additional_kwargs.timestamp — provider timestamp is sufficient
    expect(result[0]!.additional_kwargs?.timestamp).toBeUndefined();
  });

  it("passes through RemoveMessage without modification", () => {
    const remove = new RemoveMessage({ id: "h1" });

    const existing = [new HumanMessage({ content: "hello", id: "h1" })];
    const result = timestampedMessagesReducer(existing, [remove]);

    // messagesStateReducer removes the message
    expect(result).toHaveLength(0);
  });

  it("stamps all message types in a mixed batch", () => {
    const messages = [
      new HumanMessage({ content: "user msg", id: "h1" }),
      new AIMessage({
        content: "",
        id: "a1",
        tool_calls: [{ id: "tc1", name: "read_file", args: {} }],
      }),
      new ToolMessage({ content: "file contents", id: "t1", tool_call_id: "tc1" }),
      new AIMessage({ content: "done", id: "a2" }),
    ];

    const result = timestampedMessagesReducer([], messages);

    expect(result).toHaveLength(4);
    for (const msg of result) {
      expect(msg.additional_kwargs?.timestamp).toBeDefined();
      expect(new Date(msg.additional_kwargs!.timestamp as string).getTime()).not.toBeNaN();
    }
  });

  it("preserves message type identity after stamping", () => {
    const result = timestampedMessagesReducer([], [
      new HumanMessage({ content: "hello", id: "h1" }),
      new AIMessage({ content: "hi", id: "a1" }),
      new ToolMessage({ content: "result", id: "t1", tool_call_id: "tc1" }),
    ]);

    expect(result[0]).toBeInstanceOf(HumanMessage);
    expect(result[1]).toBeInstanceOf(AIMessage);
    expect(result[2]).toBeInstanceOf(ToolMessage);
  });

  it("preserves message content and id after stamping", () => {
    const result = timestampedMessagesReducer([], [
      new HumanMessage({ content: "hello world", id: "h1" }),
    ]);

    expect(result[0]!.content).toBe("hello world");
    expect(result[0]!.id).toBe("h1");
  });

  it("preserves existing additional_kwargs fields when adding timestamp", () => {
    const msg = new HumanMessage({
      content: "hello",
      id: "h1",
      additional_kwargs: { custom_field: "keep me" },
    });

    const result = timestampedMessagesReducer([], [msg]);

    expect(result[0]!.additional_kwargs?.custom_field).toBe("keep me");
    expect(result[0]!.additional_kwargs?.timestamp).toBeDefined();
  });

  it("appends to existing messages in state", () => {
    const existing = timestampedMessagesReducer([], [
      new HumanMessage({ content: "first", id: "h1" }),
    ]);

    const result = timestampedMessagesReducer(existing, [
      new AIMessage({ content: "response", id: "a1" }),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]!.additional_kwargs?.timestamp).toBeDefined();
    expect(result[1]!.additional_kwargs?.timestamp).toBeDefined();
  });
});
