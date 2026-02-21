import { describe, it, expect } from "vitest";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import {
  isContextMessage,
  createMultimodalContextMessage,
  CONTEXT_MESSAGE_NAME,
} from "langgraph-ai-sdk";
import { UploadsAPIService } from "@rails_api";

/**
 * Unit tests for queryUploads tool behavior.
 *
 * Note: The queryUploadsTool itself requires the full LangGraph runtime
 * (getCurrentTaskInput uses internal scratchpad). Full integration tests
 * are in tests/tests/graphs/brainstorm/brainstorm.test.ts under
 * "Image handling via image_url content blocks".
 *
 * These tests verify the supporting utilities and expected output format.
 */
describe("queryUploads tool utilities", () => {
  describe("UploadsAPIService.formatForModel", () => {
    it("should format uploads as image_url content blocks", () => {
      const uploads = [
        {
          id: 1,
          url: "https://example.com/image1.jpg",
          filename: "logo.jpg",
          is_logo: true,
          created_at: "2024-01-01",
        },
        {
          id: 2,
          url: "https://example.com/image2.png",
          filename: "product.png",
          is_logo: false,
          created_at: "2024-01-02",
        },
      ];

      const result = UploadsAPIService.formatForModel(uploads as any);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: "image_url",
        image_url: { url: "https://example.com/image1.jpg" },
      });
      expect(result[1]).toEqual({
        type: "image_url",
        image_url: { url: "https://example.com/image2.png" },
      });
    });

    it("should return empty array for no uploads", () => {
      const result = UploadsAPIService.formatForModel([]);
      expect(result).toEqual([]);
    });
  });

  describe("context message creation for images", () => {
    it("should create a context message with image content blocks", () => {
      const imageBlocks = UploadsAPIService.formatForModel([
        {
          id: 1,
          url: "https://example.com/image.jpg",
          filename: "test.jpg",
          is_logo: false,
          created_at: "2024-01-01",
        },
      ] as any);

      const content = [
        { type: "text" as const, text: "Here are the 1 image(s) you requested:" },
        ...imageBlocks,
      ];

      const contextMsg = createMultimodalContextMessage(content);

      expect(contextMsg._getType()).toBe("human");
      expect(isContextMessage(contextMsg)).toBe(true);
      expect((contextMsg as any).name).toBe(CONTEXT_MESSAGE_NAME);

      const msgContent = contextMsg.content as Array<any>;
      expect(msgContent[0].type).toBe("text");
      expect(msgContent[0].text).toContain("1 image(s)");
      expect(msgContent[1].type).toBe("image_url");
      expect(msgContent[1].image_url.url).toBe("https://example.com/image.jpg");
    });

    it("should create context message with multiple images", () => {
      const imageBlocks = UploadsAPIService.formatForModel([
        {
          id: 1,
          url: "https://example.com/1.jpg",
          filename: "1.jpg",
          is_logo: false,
          created_at: "2024-01-01",
        },
        {
          id: 2,
          url: "https://example.com/2.jpg",
          filename: "2.jpg",
          is_logo: false,
          created_at: "2024-01-02",
        },
        {
          id: 3,
          url: "https://example.com/3.jpg",
          filename: "3.jpg",
          is_logo: true,
          created_at: "2024-01-03",
        },
      ] as any);

      const content = [
        { type: "text" as const, text: "Here are the 3 image(s) you requested:" },
        ...imageBlocks,
      ];

      const contextMsg = createMultimodalContextMessage(content);

      const msgContent = contextMsg.content as Array<any>;
      expect(msgContent).toHaveLength(4); // 1 text + 3 images
      expect(msgContent[0].text).toContain("3 image(s)");
      expect(msgContent[1].image_url.url).toBe("https://example.com/1.jpg");
      expect(msgContent[2].image_url.url).toBe("https://example.com/2.jpg");
      expect(msgContent[3].image_url.url).toBe("https://example.com/3.jpg");
    });
  });

  describe("expected tool response format", () => {
    it("should match expected ToolMessage format", () => {
      const toolResponse = {
        success: true,
        count: 2,
        images: [
          {
            url: "https://example.com/1.jpg",
            filename: "logo.jpg",
            is_logo: true,
            created_at: "2024-01-01",
          },
          {
            url: "https://example.com/2.jpg",
            filename: "product.jpg",
            is_logo: false,
            created_at: "2024-01-02",
          },
        ],
      };

      const toolMessage = new ToolMessage({
        content: JSON.stringify(toolResponse),
        tool_call_id: "call_123",
        name: "query_uploads",
      });

      const parsed = JSON.parse(toolMessage.content as string);
      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(2);
      expect(parsed.images).toHaveLength(2);
      expect(parsed.images[0].url).toBe("https://example.com/1.jpg");
      expect(parsed.images[0].is_logo).toBe(true);
    });

    it("should match expected error format", () => {
      const errorResponse = {
        success: false,
        error: "No website associated with this brainstorm session",
        images: [],
      };

      const toolMessage = new ToolMessage({
        content: JSON.stringify(errorResponse),
        tool_call_id: "call_123",
        name: "query_uploads",
      });

      const parsed = JSON.parse(toolMessage.content as string);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("No website");
      expect(parsed.images).toHaveLength(0);
    });
  });
});
