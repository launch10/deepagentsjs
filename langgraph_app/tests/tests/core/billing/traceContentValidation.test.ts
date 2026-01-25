import { describe, it, expect, beforeAll } from "vitest";
import { DatabaseSnapshotter } from "@services";
import { brainstormGraph } from "@graphs";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { runWithUsageTracking, serializeMessages, type UsageRecord } from "@core";

/**
 * TRACE CONTENT VALIDATION TESTS - BILLING CRITICAL
 *
 * These tests verify that trace contents are EXACTLY what we expect.
 * Weak tests like "expect(trace.length > 0)" are worthless.
 *
 * We need to verify:
 * - Exact message order
 * - Exact message content
 * - Exact token counts
 * - Exact field mappings
 *
 * If any of these are wrong, we either:
 * - Can't debug customer issues (support fails)
 * - Can't prove what we charged for (legal liability)
 * - Have corrupted billing data (revenue loss)
 */

describe("Trace Content Validation - BILLING CRITICAL", () => {
  beforeAll(async () => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
  }, 30000);

  describe("Message Serialization - Exact Format", () => {
    it("MUST serialize SystemMessage with exact type and content", () => {
      const message = new SystemMessage("You are a helpful assistant for Launch10.");
      const serialized = serializeMessages([message]);

      expect(serialized).toHaveLength(1);
      expect(serialized[0]).toEqual({
        type: "system",
        content: "You are a helpful assistant for Launch10.",
        id: expect.any(String),
        is_context_message: false,
      });
    });

    it("MUST serialize HumanMessage with exact type and content", () => {
      const message = new HumanMessage("Help me name my coffee shop");
      const serialized = serializeMessages([message]);

      expect(serialized).toHaveLength(1);
      expect(serialized[0]).toEqual({
        type: "human",
        content: "Help me name my coffee shop",
        id: expect.any(String),
        is_context_message: false,
      });
    });

    it("MUST serialize AIMessage with tool_calls intact", () => {
      const message = new AIMessage({
        content: "Let me search for that.",
        tool_calls: [
          {
            id: "call_abc123",
            name: "web_search",
            args: { query: "coffee shop names" },
          },
        ],
      });

      const serialized = serializeMessages([message]);

      expect(serialized).toHaveLength(1);
      expect(serialized[0]).toMatchObject({
        type: "ai",
        content: "Let me search for that.",
        tool_calls: [
          {
            id: "call_abc123",
            name: "web_search",
            args: { query: "coffee shop names" },
          },
        ],
      });
    });

    it("MUST serialize ToolMessage with tool_call_id", () => {
      const message = new ToolMessage({
        content: "Found 10 coffee shop names",
        tool_call_id: "call_abc123",
      });

      const serialized = serializeMessages([message]);

      expect(serialized).toHaveLength(1);
      expect(serialized[0]).toMatchObject({
        type: "tool",
        content: "Found 10 coffee shop names",
        tool_call_id: "call_abc123",
      });
    });

    it("MUST preserve message order exactly", () => {
      const messages = [
        new SystemMessage("System prompt"),
        new HumanMessage("User message 1"),
        new AIMessage("Assistant response 1"),
        new HumanMessage("User message 2"),
        new AIMessage("Assistant response 2"),
      ];

      const serialized = serializeMessages(messages);

      expect(serialized).toHaveLength(5);
      expect(serialized.map((m) => m.type)).toEqual(["system", "human", "ai", "human", "ai"]);
      expect(serialized.map((m) => m.content)).toEqual([
        "System prompt",
        "User message 1",
        "Assistant response 1",
        "User message 2",
        "Assistant response 2",
      ]);
    });

    it("MUST mark context messages correctly", () => {
      const messages = [
        new SystemMessage("System"),
        new HumanMessage("Question"),
        new HumanMessage({ content: "Context info", name: "context" }),
        new AIMessage("Response"),
      ];

      const serialized = serializeMessages(messages);

      expect(serialized[0]!.is_context_message).toBe(false);
      expect(serialized[1]!.is_context_message).toBe(false);
      expect(serialized[2]!.is_context_message).toBe(true);
      expect(serialized[3]!.is_context_message).toBe(false);
    });

    it("MUST preserve usage_metadata for billing verification", () => {
      const message = new AIMessage({
        content: "Response",
        usage_metadata: {
          input_tokens: 1500,
          output_tokens: 500,
          cache_creation_input_tokens: 100,
          cache_read_input_tokens: 50,
        },
      });

      const serialized = serializeMessages([message]);

      expect(serialized[0]!.usage_metadata).toEqual({
        input_tokens: 1500,
        output_tokens: 500,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 50,
      });
    });

    it("MUST preserve response_metadata for debugging", () => {
      const message = new AIMessage({
        content: "Response",
        response_metadata: {
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          stop_sequence: null,
        },
      });

      const serialized = serializeMessages([message]);

      expect(serialized[0]!.response_metadata).toEqual({
        model: "claude-3-opus-20240229",
        stop_reason: "end_turn",
        stop_sequence: null,
      });
    });
  });

  describe("Usage Record - Exact Fields", () => {
    const compiledBrainstorm = brainstormGraph.compile({
      checkpointer: new MemorySaver(),
      name: "brainstorm",
    });

    it("MUST capture all required billing fields", async () => {
      const { usage, runId } = await runWithUsageTracking(
        {
          chatId: 1,
          threadId: "test-fields-validation",
          graphName: "brainstorm",
        },
        async () => {
          return await compiledBrainstorm.invoke(
            {
              messages: [new HumanMessage("Test")],
              jwt: "test-jwt",
              threadId: "test-fields-validation",
            },
            { configurable: { thread_id: "test-fields-validation" } }
          );
        }
      );

      expect(usage.length).toBeGreaterThan(0);

      const record = usage[0]!;

      // Required fields - MUST be present and valid
      expect(record.runId).toBe(runId);
      expect(record.runId).toMatch(/^[a-f0-9-]{36}$/); // UUID format

      expect(record.messageId).toBeDefined();
      expect(record.messageId!.length).toBeGreaterThan(0);

      expect(record.langchainRunId).toBeDefined();
      expect(record.langchainRunId.length).toBeGreaterThan(0);

      expect(record.model).toBeDefined();
      expect(record.model.length).toBeGreaterThan(0);
      expect(record.model).toMatch(/claude|gpt|gemini/i); // Known models

      expect(record.inputTokens).toBeGreaterThan(0);
      expect(Number.isInteger(record.inputTokens)).toBe(true);

      expect(record.outputTokens).toBeGreaterThan(0);
      expect(Number.isInteger(record.outputTokens)).toBe(true);

      expect(record.timestamp).toBeInstanceOf(Date);
      expect(record.timestamp.getTime()).toBeGreaterThan(0);
    });

    it("MUST capture cache tokens when present (Anthropic)", async () => {
      const { usage } = await runWithUsageTracking(
        {
          chatId: 1,
          threadId: "test-cache-tokens",
          graphName: "brainstorm",
        },
        async () => {
          // Use a long system prompt to trigger caching
          return await compiledBrainstorm.invoke(
            {
              messages: [
                new SystemMessage(
                  "You are a helpful assistant for Launch10. " +
                    "This is a long system prompt that should trigger caching. ".repeat(50)
                ),
                new HumanMessage("Hello"),
              ],
              jwt: "test-jwt",
              threadId: "test-cache-tokens",
            },
            { configurable: { thread_id: "test-cache-tokens" } }
          );
        }
      );

      expect(usage.length).toBeGreaterThan(0);

      const record = usage[0]!;

      // Cache fields should be numbers (may be 0 if caching didn't trigger)
      expect(typeof record.cacheCreationTokens).toBe("number");
      expect(typeof record.cacheReadTokens).toBe("number");
      expect(record.cacheCreationTokens).toBeGreaterThanOrEqual(0);
      expect(record.cacheReadTokens).toBeGreaterThanOrEqual(0);
    });

    it("MUST NOT have undefined or NaN token values", async () => {
      const { usage } = await runWithUsageTracking(
        {
          chatId: 1,
          threadId: "test-no-undefined",
          graphName: "brainstorm",
        },
        async () => {
          return await compiledBrainstorm.invoke(
            {
              messages: [new HumanMessage("Quick test")],
              jwt: "test-jwt",
              threadId: "test-no-undefined",
            },
            { configurable: { thread_id: "test-no-undefined" } }
          );
        }
      );

      expect(usage.length).toBeGreaterThan(0);

      for (const record of usage) {
        expect(record.inputTokens).not.toBeNaN();
        expect(record.inputTokens).not.toBeUndefined();

        expect(record.outputTokens).not.toBeNaN();
        expect(record.outputTokens).not.toBeUndefined();

        expect(record.cacheCreationTokens).not.toBeNaN();
        expect(record.cacheReadTokens).not.toBeNaN();
        expect(record.reasoningTokens).not.toBeNaN();
      }
    });
  });

  describe("Full Trace - Complete Conversation", () => {
    const compiledBrainstorm = brainstormGraph.compile({
      checkpointer: new MemorySaver(),
      name: "brainstorm",
    });

    it("MUST capture complete conversation in correct order", async () => {
      const systemPrompt = "You are a coffee shop naming expert for Launch10.";
      const userQuestion = "What are some creative names for a minimalist coffee shop?";

      const { messages, usage, runId } = await runWithUsageTracking(
        {
          chatId: 1,
          threadId: "test-complete-trace",
          graphName: "brainstorm",
        },
        async () => {
          return await compiledBrainstorm.invoke(
            {
              messages: [new SystemMessage(systemPrompt), new HumanMessage(userQuestion)],
              jwt: "test-jwt",
              threadId: "test-complete-trace",
            },
            { configurable: { thread_id: "test-complete-trace" } }
          );
        }
      );

      // Must have at least: System, Human, AI
      expect(messages.length).toBeGreaterThanOrEqual(3);

      // First message MUST be system
      expect(messages[0]!._getType()).toBe("system");
      expect(messages[0]!.content).toBe(systemPrompt);

      // Second message MUST be human
      expect(messages[1]!._getType()).toBe("human");
      expect(messages[1]!.content).toBe(userQuestion);

      // Third message MUST be AI response
      expect(messages[2]!._getType()).toBe("ai");
      expect((messages[2]!.content as string).length).toBeGreaterThan(0);

      // Usage MUST be correlated
      expect(usage.length).toBeGreaterThan(0);
      expect(usage[0]!.runId).toBe(runId);
    });

    it("MUST include AI message content in trace", async () => {
      const { messages } = await runWithUsageTracking(
        {
          chatId: 1,
          threadId: "test-ai-content",
          graphName: "brainstorm",
        },
        async () => {
          return await compiledBrainstorm.invoke(
            {
              messages: [new HumanMessage("Respond with exactly: I AM AN AI")],
              jwt: "test-jwt",
              threadId: "test-ai-content",
            },
            { configurable: { thread_id: "test-ai-content" } }
          );
        }
      );

      const aiMessages = messages.filter((m) => m._getType() === "ai");
      expect(aiMessages.length).toBeGreaterThan(0);

      // AI message content should not be empty
      const aiContent = aiMessages[0]!.content;
      expect(typeof aiContent === "string" ? aiContent.length : 0).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases - Data Integrity", () => {
    it("MUST handle messages with multimodal content", () => {
      const message = new HumanMessage({
        content: [
          { type: "text", text: "What's in this image?" },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
          },
        ],
      });

      const serialized = serializeMessages([message]);

      expect(serialized).toHaveLength(1);
      expect(serialized[0]!.type).toBe("human");
      expect(serialized[0]!.content).toEqual([
        { type: "text", text: "What's in this image?" },
        {
          type: "image_url",
          image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
        },
      ]);
    });

    it("MUST handle empty string content", () => {
      // Some edge cases produce empty content
      const message = new AIMessage("");
      const serialized = serializeMessages([message]);

      expect(serialized).toHaveLength(1);
      expect(serialized[0]!.content).toBe("");
    });

    it("MUST handle unicode and special characters", () => {
      const message = new HumanMessage("Hello 世界! 🎉 Café résumé naïve");
      const serialized = serializeMessages([message]);

      expect(serialized[0]!.content).toBe("Hello 世界! 🎉 Café résumé naïve");
    });

    it("MUST handle very long messages", () => {
      const longContent = "A".repeat(100000);
      const message = new HumanMessage(longContent);
      const serialized = serializeMessages([message]);

      expect(serialized[0]!.content).toBe(longContent);
      expect((serialized[0]!.content as string).length).toBe(100000);
    });
  });
});
