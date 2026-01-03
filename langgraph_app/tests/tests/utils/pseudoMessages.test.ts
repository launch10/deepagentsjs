import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import {
  isPseudoMessage,
  createPseudoMessage,
  createMultimodalPseudoMessage,
  filterPseudoMessages,
  injectPseudoMessage,
} from "@utils";

describe("Pseudo Messages Utility", () => {
  describe("isPseudoMessage", () => {
    it("should identify pseudo messages by isPseudo flag", () => {
      const pseudoMsg = new HumanMessage({
        content: "Generate assets now.",
        additional_kwargs: { isPseudo: true },
      });
      expect(isPseudoMessage(pseudoMsg)).toBe(true);
    });

    it("should identify multimodal pseudo messages by flag", () => {
      const pseudoMsg = new HumanMessage({
        content: [
          { type: "text", text: "Here are the images:" },
          { type: "image_url", image_url: { url: "https://example.com/image.jpg" } },
        ],
        additional_kwargs: { isPseudo: true },
      });
      expect(isPseudoMessage(pseudoMsg)).toBe(true);
    });

    it("should return false for regular human messages", () => {
      const regularMsg = new HumanMessage("Hello, how are you?");
      expect(isPseudoMessage(regularMsg)).toBe(false);
    });

    it("should return false for AI messages", () => {
      const aiMsg = new AIMessage("I'm doing well, thanks!");
      expect(isPseudoMessage(aiMsg)).toBe(false);
    });

    it("should return false for tool messages", () => {
      const toolMsg = new ToolMessage({
        content: "Tool result",
        tool_call_id: "call_123",
      });
      expect(isPseudoMessage(toolMsg)).toBe(false);
    });

    it("should return false for multimodal messages without isPseudo flag", () => {
      const multimodalMsg = new HumanMessage({
        content: [
          { type: "text", text: "Check out this image:" },
          { type: "image_url", image_url: { url: "https://example.com/image.jpg" } },
        ],
      });
      expect(isPseudoMessage(multimodalMsg)).toBe(false);
    });
  });

  describe("createPseudoMessage", () => {
    it("should create a human message with isPseudo flag", () => {
      const msg = createPseudoMessage("Generate assets now.");
      expect(msg).toBeInstanceOf(HumanMessage);
      expect(msg.content).toBe("Generate assets now.");
      expect(msg.additional_kwargs.isPseudo).toBe(true);
    });

    it("should be identified as a pseudo message", () => {
      const msg = createPseudoMessage("Do something");
      expect(isPseudoMessage(msg)).toBe(true);
    });
  });

  describe("createMultimodalPseudoMessage", () => {
    it("should create a human message with multimodal content and isPseudo flag", () => {
      const content = [
        { type: "text" as const, text: "Here are 2 images:" },
        { type: "image_url" as const, image_url: { url: "https://example.com/1.jpg" } },
        { type: "image_url" as const, image_url: { url: "https://example.com/2.jpg" } },
      ];
      const msg = createMultimodalPseudoMessage(content);

      expect(msg).toBeInstanceOf(HumanMessage);
      expect(msg.content).toEqual(content);
      expect(msg.additional_kwargs.isPseudo).toBe(true);
    });

    it("should be identified as a pseudo message", () => {
      const msg = createMultimodalPseudoMessage([
        { type: "text", text: "Image:" },
        { type: "image_url", image_url: { url: "https://example.com/img.jpg" } },
      ]);
      expect(isPseudoMessage(msg)).toBe(true);
    });
  });

  describe("filterPseudoMessages", () => {
    it("should filter out pseudo messages", () => {
      const messages = [
        new HumanMessage("Hello"),
        createPseudoMessage("Generate assets."),
        new AIMessage("Hi there!"),
        createPseudoMessage("Refresh content."),
      ];

      const filtered = filterPseudoMessages(messages);
      expect(filtered).toHaveLength(2);
      expect(filtered[0]!.content).toBe("Hello");
      expect(filtered[1]!.content).toBe("Hi there!");
    });

    it("should filter out multimodal pseudo messages", () => {
      const regularMultimodal = new HumanMessage({
        content: [
          { type: "text", text: "My logo:" },
          { type: "image_url", image_url: { url: "https://example.com/logo.jpg" } },
        ],
      });

      const pseudoMultimodal = createMultimodalPseudoMessage([
        { type: "text", text: "Here are the images:" },
        { type: "image_url", image_url: { url: "https://example.com/fetched.jpg" } },
      ]);

      const messages = [
        new HumanMessage("Hello"),
        regularMultimodal,
        pseudoMultimodal,
        new AIMessage("Got it!"),
      ];

      const filtered = filterPseudoMessages(messages);
      expect(filtered).toHaveLength(3);
      expect(filtered[0]!.content).toBe("Hello");
      expect(filtered[1]).toBe(regularMultimodal);
      expect(filtered[2]!.content).toBe("Got it!");
    });

    it("should filter out both text and multimodal pseudo messages", () => {
      const messages = [
        new HumanMessage("User message"),
        createPseudoMessage("Text pseudo"),
        createMultimodalPseudoMessage([{ type: "text", text: "Images" }]),
        new AIMessage("Response"),
      ];

      const filtered = filterPseudoMessages(messages);
      expect(filtered).toHaveLength(2);
      expect(filtered[0]!.content).toBe("User message");
      expect(filtered[1]!.content).toBe("Response");
    });

    it("should return empty array when all messages are pseudo", () => {
      const messages = [
        createPseudoMessage("First"),
        createPseudoMessage("Second"),
      ];

      const filtered = filterPseudoMessages(messages);
      expect(filtered).toHaveLength(0);
    });

    it("should return all messages when none are pseudo", () => {
      const messages = [
        new HumanMessage("Hello"),
        new AIMessage("Hi!"),
        new HumanMessage("How are you?"),
      ];

      const filtered = filterPseudoMessages(messages);
      expect(filtered).toHaveLength(3);
    });
  });

  describe("injectPseudoMessage", () => {
    it("should append pseudo message to end of array when provided", () => {
      const messages = [
        new HumanMessage("Hello"),
        new AIMessage("Hi!"),
      ];
      const pseudo = createPseudoMessage("Generate now.");

      const result = injectPseudoMessage(messages, pseudo);
      expect(result).toHaveLength(3);
      expect(result[0]!.content).toBe("Hello");
      expect(result[1]!.content).toBe("Hi!");
      expect(result[2]!.content).toBe("Generate now.");
    });

    it("should return original messages when pseudo is null", () => {
      const messages = [
        new HumanMessage("Hello"),
        new AIMessage("Hi!"),
      ];

      const result = injectPseudoMessage(messages, null);
      expect(result).toHaveLength(2);
      expect(result).toEqual(messages);
    });

    it("should not mutate the original array", () => {
      const messages = [new HumanMessage("Hello")];
      const pseudo = createPseudoMessage("Generate now.");

      const result = injectPseudoMessage(messages, pseudo);
      expect(messages).toHaveLength(1);
      expect(result).toHaveLength(2);
    });
  });
});
