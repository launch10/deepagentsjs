import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import {
  isContextMessage,
  createContextMessage,
  createMultimodalContextMessage,
  filterContextMessages,
  injectContextMessage,
  CONTEXT_MESSAGE_NAME,
} from "langgraph-ai-sdk";

describe("Context Messages Utility", () => {
  describe("isContextMessage", () => {
    it("should identify context messages by name property", () => {
      const contextMsg = new HumanMessage({
        content: "Generate assets now.",
        name: CONTEXT_MESSAGE_NAME,
      });
      expect(isContextMessage(contextMsg)).toBe(true);
    });

    it("should identify multimodal context messages by name property", () => {
      const contextMsg = new HumanMessage({
        content: [
          { type: "text", text: "Here are the images:" },
          { type: "image_url", image_url: { url: "https://example.com/image.jpg" } },
        ],
        name: CONTEXT_MESSAGE_NAME,
      });
      expect(isContextMessage(contextMsg)).toBe(true);
    });

    it("should return false for regular human messages", () => {
      const regularMsg = new HumanMessage("Hello, how are you?");
      expect(isContextMessage(regularMsg)).toBe(false);
    });

    it("should return false for AI messages", () => {
      const aiMsg = new AIMessage("I'm doing well, thanks!");
      expect(isContextMessage(aiMsg)).toBe(false);
    });

    it("should return false for tool messages", () => {
      const toolMsg = new ToolMessage({
        content: "Tool result",
        tool_call_id: "call_123",
      });
      expect(isContextMessage(toolMsg)).toBe(false);
    });

    it("should return false for multimodal messages without context name", () => {
      const multimodalMsg = new HumanMessage({
        content: [
          { type: "text", text: "Check out this image:" },
          { type: "image_url", image_url: { url: "https://example.com/image.jpg" } },
        ],
      });
      expect(isContextMessage(multimodalMsg)).toBe(false);
    });
  });

  describe("createContextMessage", () => {
    it("should create a human message with context name", () => {
      const msg = createContextMessage("Generate assets now.");
      expect(msg._getType()).toBe("human");
      expect(msg.content).toBe("Generate assets now.");
      expect((msg as any).name).toBe(CONTEXT_MESSAGE_NAME);
    });

    it("should be identified as a context message", () => {
      const msg = createContextMessage("Do something");
      expect(isContextMessage(msg)).toBe(true);
    });
  });

  describe("createMultimodalContextMessage", () => {
    it("should create a human message with multimodal content and context name", () => {
      const content = [
        { type: "text" as const, text: "Here are 2 images:" },
        { type: "image_url" as const, image_url: { url: "https://example.com/1.jpg" } },
        { type: "image_url" as const, image_url: { url: "https://example.com/2.jpg" } },
      ];
      const msg = createMultimodalContextMessage(content);

      expect(msg._getType()).toBe("human");
      expect(msg.content).toEqual(content);
      expect((msg as any).name).toBe(CONTEXT_MESSAGE_NAME);
    });

    it("should be identified as a context message", () => {
      const msg = createMultimodalContextMessage([
        { type: "text", text: "Image:" },
        { type: "image_url", image_url: { url: "https://example.com/img.jpg" } },
      ]);
      expect(isContextMessage(msg)).toBe(true);
    });
  });

  describe("filterContextMessages", () => {
    it("should filter out context messages", () => {
      const messages = [
        new HumanMessage("Hello"),
        createContextMessage("Generate assets."),
        new AIMessage("Hi there!"),
        createContextMessage("Refresh content."),
      ];

      const filtered = filterContextMessages(messages);
      expect(filtered).toHaveLength(2);
      expect(filtered[0]!.content).toBe("Hello");
      expect(filtered[1]!.content).toBe("Hi there!");
    });

    it("should filter out multimodal context messages", () => {
      const regularMultimodal = new HumanMessage({
        content: [
          { type: "text", text: "My logo:" },
          { type: "image_url", image_url: { url: "https://example.com/logo.jpg" } },
        ],
      });

      const contextMultimodal = createMultimodalContextMessage([
        { type: "text", text: "Here are the images:" },
        { type: "image_url", image_url: { url: "https://example.com/fetched.jpg" } },
      ]);

      const messages = [
        new HumanMessage("Hello"),
        regularMultimodal,
        contextMultimodal,
        new AIMessage("Got it!"),
      ];

      const filtered = filterContextMessages(messages);
      expect(filtered).toHaveLength(3);
      expect(filtered[0]!.content).toBe("Hello");
      expect(filtered[1]).toBe(regularMultimodal);
      expect(filtered[2]!.content).toBe("Got it!");
    });

    it("should filter out both text and multimodal context messages", () => {
      const messages = [
        new HumanMessage("User message"),
        createContextMessage("Text context"),
        createMultimodalContextMessage([{ type: "text", text: "Images" }]),
        new AIMessage("Response"),
      ];

      const filtered = filterContextMessages(messages);
      expect(filtered).toHaveLength(2);
      expect(filtered[0]!.content).toBe("User message");
      expect(filtered[1]!.content).toBe("Response");
    });

    it("should return empty array when all messages are context messages", () => {
      const messages = [createContextMessage("First"), createContextMessage("Second")];

      const filtered = filterContextMessages(messages);
      expect(filtered).toHaveLength(0);
    });

    it("should return all messages when none are context messages", () => {
      const messages = [
        new HumanMessage("Hello"),
        new AIMessage("Hi!"),
        new HumanMessage("How are you?"),
      ];

      const filtered = filterContextMessages(messages);
      expect(filtered).toHaveLength(3);
    });
  });

  describe("injectContextMessage", () => {
    it("should append context message to end of array when provided", () => {
      const messages = [new HumanMessage("Hello"), new AIMessage("Hi!")];
      const context = createContextMessage("Generate now.");

      const result = injectContextMessage(messages, context);
      expect(result).toHaveLength(3);
      expect(result[0]!.content).toBe("Hello");
      expect(result[1]!.content).toBe("Hi!");
      expect(result[2]!.content).toBe("Generate now.");
    });

    it("should return original messages when context is null", () => {
      const messages = [new HumanMessage("Hello"), new AIMessage("Hi!")];

      const result = injectContextMessage(messages, null);
      expect(result).toHaveLength(2);
      expect(result).toEqual(messages);
    });

    it("should not mutate the original array", () => {
      const messages = [new HumanMessage("Hello")];
      const context = createContextMessage("Generate now.");

      const result = injectContextMessage(messages, context);
      expect(messages).toHaveLength(1);
      expect(result).toHaveLength(2);
    });
  });
});
