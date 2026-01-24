import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { createContextMessage } from "langgraph-ai-sdk";
import { usageTracker, getUsageContext, runWithUsageTracking } from "@core";
import { createAnthropicAIMessage, createLLMResult } from "@support";

/**
 * Tests for clean message trace capture.
 *
 * The goal is to capture a flat, ordered array of ALL messages:
 * [SystemMessage, HumanMessage, ContextMessage, AIMessage, ToolMessage, AIMessage, ...]
 *
 * This replaces the fragmented approach of separate systemPrompt/userInput/messagesProduced.
 */
describe("Message Trace Capture", () => {
  describe("handleChatModelStart captures input messages", () => {
    it("captures SystemMessage from input", async () => {
      const { messages } = await runWithUsageTracking({}, async () => {
        const inputMessages = [
          new SystemMessage("You are a helpful assistant."),
          new HumanMessage("Hello"),
        ];

        await usageTracker.handleChatModelStart(
          { name: "test" } as any,
          [inputMessages],
          "run-123"
        );

        return "done";
      });

      expect(messages).toHaveLength(2);
      expect(messages[0]!._getType()).toBe("system");
      expect(messages[0]!.content).toBe("You are a helpful assistant.");
      expect(messages[1]!._getType()).toBe("human");
      expect(messages[1]!.content).toBe("Hello");
    });

    it("captures ContextMessage (HumanMessage with name='context') from input", async () => {
      const { messages } = await runWithUsageTracking({}, async () => {
        const contextMsg = createContextMessage("User is viewing the pricing page");
        const inputMessages = [
          new SystemMessage("You are a helpful assistant."),
          new HumanMessage("What are the prices?"),
          contextMsg,
        ];

        await usageTracker.handleChatModelStart(
          { name: "test" } as any,
          [inputMessages],
          "run-123"
        );

        return "done";
      });

      expect(messages).toHaveLength(3);
      expect(messages[2]!._getType()).toBe("human");
      expect((messages[2] as any).name).toBe("context");
      expect(messages[2]!.content).toBe("User is viewing the pricing page");
    });

    it("captures full conversation history from input", async () => {
      const { messages } = await runWithUsageTracking({}, async () => {
        const inputMessages = [
          new SystemMessage("You are a helpful assistant."),
          new HumanMessage("Hello"),
          new AIMessage("Hi! How can I help?"),
          new HumanMessage("Tell me about pricing"),
        ];

        await usageTracker.handleChatModelStart(
          { name: "test" } as any,
          [inputMessages],
          "run-123"
        );

        return "done";
      });

      expect(messages).toHaveLength(4);
      expect(messages.map((m) => m._getType())).toEqual(["system", "human", "ai", "human"]);
    });

    it("only captures input messages once on first LLM call", async () => {
      const { messages } = await runWithUsageTracking({}, async () => {
        const firstInput = [new SystemMessage("System prompt"), new HumanMessage("First message")];

        const secondInput = [
          new SystemMessage("System prompt"),
          new HumanMessage("First message"),
          new AIMessage("First response"),
          new ToolMessage({ content: "Tool result", tool_call_id: "call_1" }),
        ];

        // First LLM call - should capture
        await usageTracker.handleChatModelStart({ name: "test" } as any, [firstInput], "run-1");

        // Second LLM call - should NOT re-capture the same messages
        await usageTracker.handleChatModelStart({ name: "test" } as any, [secondInput], "run-2");

        return "done";
      });

      // Should have captured: System, Human from first call
      // The AIMessage and ToolMessage from second call's input are NEW messages
      // that weren't in the first call, so they should be captured
      expect(messages).toHaveLength(4);
      expect(messages.map((m) => m._getType())).toEqual(["system", "human", "ai", "tool"]);
    });
  });

  describe("handleLLMEnd appends output messages", () => {
    it("appends AIMessage output to messages array", async () => {
      const { messages } = await runWithUsageTracking({}, async () => {
        // First capture inputs
        const inputMessages = [
          new SystemMessage("You are a helpful assistant."),
          new HumanMessage("Hello"),
        ];
        await usageTracker.handleChatModelStart(
          { name: "test" } as any,
          [inputMessages],
          "run-123"
        );

        // Then capture output
        const aiMessage = createAnthropicAIMessage("Hi there!");
        await usageTracker.handleLLMEnd(createLLMResult(aiMessage), "run-123");

        return "done";
      });

      expect(messages).toHaveLength(3);
      expect(messages.map((m) => m._getType())).toEqual(["system", "human", "ai"]);
      expect(messages[2]!.content).toBe("Hi there!");
    });

    it("handles multi-turn with tools correctly", async () => {
      const { messages } = await runWithUsageTracking({}, async () => {
        // Turn 1: Initial input
        const turn1Input = [
          new SystemMessage("You are a helpful assistant."),
          new HumanMessage("Search for cats"),
        ];
        await usageTracker.handleChatModelStart({ name: "test" } as any, [turn1Input], "run-1");

        // Turn 1: AI decides to use tool (unique message ID)
        const aiWithToolCall = createAnthropicAIMessage(
          "I'll search for that",
          {},
          "msg_ai_tool_call_1"
        );
        (aiWithToolCall as any).tool_calls = [
          { id: "call_1", name: "search", args: { query: "cats" } },
        ];
        await usageTracker.handleLLMEnd(createLLMResult(aiWithToolCall), "run-1");

        // Turn 2: Input now includes tool result
        const turn2Input = [
          new SystemMessage("You are a helpful assistant."),
          new HumanMessage("Search for cats"),
          aiWithToolCall,
          new ToolMessage({ content: "Found 5 cats", tool_call_id: "call_1" }),
        ];
        await usageTracker.handleChatModelStart({ name: "test" } as any, [turn2Input], "run-2");

        // Turn 2: Final response (different unique message ID)
        const finalResponse = createAnthropicAIMessage(
          "I found 5 cats for you!",
          {},
          "msg_ai_final_response"
        );
        await usageTracker.handleLLMEnd(createLLMResult(finalResponse), "run-2");

        return "done";
      });

      // Should have: System, Human, AI (with tool call), Tool, AI (final)
      expect(messages).toHaveLength(5);
      expect(messages.map((m) => m._getType())).toEqual(["system", "human", "ai", "tool", "ai"]);
    });
  });

  describe("full conversation trace", () => {
    it("captures complete ordered trace with context messages", async () => {
      const { messages, runId } = await runWithUsageTracking({}, async () => {
        const contextMsg = createContextMessage("User has 3 items in cart");

        const inputMessages = [
          new SystemMessage("You are a shopping assistant."),
          new HumanMessage("What's in my cart?"),
          contextMsg,
        ];

        await usageTracker.handleChatModelStart(
          { name: "test" } as any,
          [inputMessages],
          "run-123"
        );

        const aiResponse = createAnthropicAIMessage("You have 3 items in your cart.");
        await usageTracker.handleLLMEnd(createLLMResult(aiResponse), "run-123");

        return "done";
      });

      expect(messages).toHaveLength(4);
      expect(messages.map((m) => m._getType())).toEqual([
        "system",
        "human",
        "human", // context message is HumanMessage with name="context"
        "ai",
      ]);

      // Verify context message is identifiable
      expect((messages[2] as any).name).toBe("context");
      expect(runId).toBeDefined();
    });

    it("does not duplicate messages already captured", async () => {
      const { messages } = await runWithUsageTracking({}, async () => {
        const systemMsg = new SystemMessage("System prompt");
        const humanMsg = new HumanMessage("Hello");

        // First call
        await usageTracker.handleChatModelStart(
          { name: "test" } as any,
          [[systemMsg, humanMsg]],
          "run-1"
        );

        // First AI response (unique message ID)
        const ai1 = createAnthropicAIMessage("Response 1", {}, "msg_ai_response_1");
        await usageTracker.handleLLMEnd(createLLMResult(ai1), "run-1");

        // Second call - includes previous messages plus new tool result
        const toolMsg = new ToolMessage({ content: "Tool output", tool_call_id: "call_1" });
        await usageTracker.handleChatModelStart(
          { name: "test" } as any,
          [[systemMsg, humanMsg, ai1, toolMsg]],
          "run-2"
        );

        // Second AI response (different unique message ID)
        const ai2 = createAnthropicAIMessage("Response 2", {}, "msg_ai_response_2");
        await usageTracker.handleLLMEnd(createLLMResult(ai2), "run-2");

        return "done";
      });

      // Each message should appear exactly once
      expect(messages).toHaveLength(5);
      expect(messages.map((m) => m._getType())).toEqual(["system", "human", "ai", "tool", "ai"]);
    });
  });

  describe("backwards compatibility", () => {
    it("still provides systemPrompt for convenience", async () => {
      const { systemPrompt, messages } = await runWithUsageTracking({}, async () => {
        const inputMessages = [
          new SystemMessage("You are a coding assistant."),
          new HumanMessage("Help me code"),
        ];

        await usageTracker.handleChatModelStart(
          { name: "test" } as any,
          [inputMessages],
          "run-123"
        );

        return "done";
      });

      // systemPrompt is still available as convenience field
      expect(systemPrompt).toBe("You are a coding assistant.");
      // But it's also in the messages array
      expect(messages[0]!.content).toBe("You are a coding assistant.");
    });
  });
});
