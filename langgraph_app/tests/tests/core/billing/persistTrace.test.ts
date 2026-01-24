import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { createContextMessage } from "langgraph-ai-sdk";
import { serializeMessages, type TraceContext, type UsageSummary } from "@core";

// For persistTrace tests, we'll test serializeMessages directly
// and use a separate integration test for actual DB writes

describe("persistTrace", () => {
  describe("serializeMessages", () => {
    it("serializes SystemMessage correctly", () => {
      const messages = [new SystemMessage("You are a helpful assistant.")];
      const serialized = serializeMessages(messages);

      expect(serialized).toHaveLength(1);
      expect(serialized[0]).toMatchObject({
        type: "system",
        content: "You are a helpful assistant.",
        is_context_message: false,
      });
    });

    it("serializes HumanMessage correctly", () => {
      const messages = [new HumanMessage("Hello")];
      const serialized = serializeMessages(messages);

      expect(serialized).toHaveLength(1);
      expect(serialized[0]).toMatchObject({
        type: "human",
        content: "Hello",
        is_context_message: false,
      });
    });

    it("serializes AIMessage with tool_calls correctly", () => {
      const aiMsg = new AIMessage("I'll search for that");
      (aiMsg as any).tool_calls = [{ id: "call_1", name: "search", args: { query: "cats" } }];
      const serialized = serializeMessages([aiMsg]);

      expect(serialized[0]).toMatchObject({
        type: "ai",
        content: "I'll search for that",
        tool_calls: [{ id: "call_1", name: "search", args: { query: "cats" } }],
        is_context_message: false,
      });
    });

    it("serializes ToolMessage correctly", () => {
      const toolMsg = new ToolMessage({
        content: "Found 5 results",
        tool_call_id: "call_1",
      });
      const serialized = serializeMessages([toolMsg]);

      expect(serialized[0]).toMatchObject({
        type: "tool",
        content: "Found 5 results",
        tool_call_id: "call_1",
        is_context_message: false,
      });
    });

    it("marks context messages with is_context_message: true", () => {
      const contextMsg = createContextMessage("User is on pricing page");
      const serialized = serializeMessages([contextMsg]);

      expect(serialized[0]).toMatchObject({
        type: "human",
        name: "context",
        content: "User is on pricing page",
        is_context_message: true,
      });
    });

    it("serializes full conversation preserving order", () => {
      const messages = [
        new SystemMessage("System prompt"),
        new HumanMessage("Hello"),
        createContextMessage("Context info"),
        new AIMessage("Hi there!"),
        new ToolMessage({ content: "Tool result", tool_call_id: "call_1" }),
        new AIMessage("Final response"),
      ];
      const serialized = serializeMessages(messages);

      expect(serialized).toHaveLength(6);
      expect(serialized.map((m) => m.type)).toEqual([
        "system",
        "human",
        "human", // context message is HumanMessage
        "ai",
        "tool",
        "ai",
      ]);
      expect(serialized.map((m) => m.is_context_message)).toEqual([
        false,
        false,
        true, // context message
        false,
        false,
        false,
      ]);
    });

    it("includes message IDs when present", () => {
      const aiMsg = new AIMessage({ content: "Response", id: "msg_123" });
      const serialized = serializeMessages([aiMsg]);

      expect(serialized[0]!.id).toBe("msg_123");
    });

    it("includes usage_metadata when present", () => {
      const aiMsg = new AIMessage("Response");
      (aiMsg as any).usage_metadata = {
        input_tokens: 100,
        output_tokens: 50,
      };
      const serialized = serializeMessages([aiMsg]);

      expect(serialized[0]!.usage_metadata).toEqual({
        input_tokens: 100,
        output_tokens: 50,
      });
    });

    it("includes response_metadata when present", () => {
      const aiMsg = new AIMessage("Response");
      (aiMsg as any).response_metadata = {
        model: "claude-haiku-4-5-20251001",
        stop_reason: "end_turn",
      };
      const serialized = serializeMessages([aiMsg]);

      expect(serialized[0]!.response_metadata).toEqual({
        model: "claude-haiku-4-5-20251001",
        stop_reason: "end_turn",
      });
    });
  });

  // Note: Database write tests for persistTrace() are in integration tests
  // since they require actual DB connection. The serializeMessages() unit tests
  // above cover the core serialization logic.
});
