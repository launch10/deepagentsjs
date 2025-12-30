import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { UploadInjectionService } from "@services";

/**
 * Unit tests for UploadInjectionService.
 *
 * These tests verify the internal logic of the service by testing:
 * - Empty/undefined uploadIds handling (no API call needed)
 * - Message content normalization and injection logic
 *
 * For the actual API integration (fetching uploads by IDs), see the
 * integration tests that use real upload fixtures.
 */
describe("UploadInjectionService", () => {
  describe("injectUploads - edge cases", () => {
    it("returns messages unchanged when uploadIds is empty", async () => {
      const service = new UploadInjectionService("test-jwt");
      const messages = [new HumanMessage("Hello")];

      const result = await service.injectUploads(messages, []);

      expect(result).toEqual(messages);
    });

    it("returns messages unchanged when uploadIds is undefined", async () => {
      const service = new UploadInjectionService("test-jwt");
      const messages = [new HumanMessage("Hello")];

      const result = await service.injectUploads(messages, undefined as unknown as number[]);

      expect(result).toEqual(messages);
    });

    it("returns messages unchanged when no human message exists", async () => {
      const service = new UploadInjectionService("test-jwt");
      const messages = [new AIMessage("AI only")];

      // Even with uploadIds, should return unchanged if no human message
      const result = await service.injectUploads(messages, [1, 2, 3]);

      expect(result).toEqual(messages);
    });
  });

  describe("uploadsToContentBlocks - content block creation", () => {
    // Test the content block creation logic directly
    // We can access the private method via type casting for testing

    it("creates image_url blocks for image uploads", () => {
      const service = new UploadInjectionService("test-jwt");
      const uploads = [
        { id: 1, media_type: "image", url: "https://example.com/img1.png", filename: "img1.png" },
        { id: 2, media_type: "image", url: "https://example.com/img2.png", filename: "img2.png" },
      ];

      // Access private method for testing
      const blocks = (service as any).uploadsToContentBlocks(uploads);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
        type: "image_url",
        image_url: { url: "https://example.com/img1.png", detail: "auto" },
      });
      expect(blocks[1]).toEqual({
        type: "image_url",
        image_url: { url: "https://example.com/img2.png", detail: "auto" },
      });
    });

    it("creates text blocks for document uploads", () => {
      const service = new UploadInjectionService("test-jwt");
      const uploads = [
        { id: 1, media_type: "document", url: "https://example.com/doc.pdf", filename: "business-plan.pdf" },
      ];

      const blocks = (service as any).uploadsToContentBlocks(uploads);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: "text",
        text: "[Attached document: business-plan.pdf]",
      });
    });

    it("handles mixed upload types correctly", () => {
      const service = new UploadInjectionService("test-jwt");
      const uploads = [
        { id: 1, media_type: "image", url: "https://example.com/logo.png", filename: "logo.png" },
        { id: 2, media_type: "document", url: "https://example.com/doc.pdf", filename: "plan.pdf" },
        { id: 3, media_type: "image", url: "https://example.com/screen.png", filename: "screen.png" },
      ];

      const blocks = (service as any).uploadsToContentBlocks(uploads);

      expect(blocks).toHaveLength(3);
      expect(blocks[0].type).toBe("image_url");
      expect(blocks[1].type).toBe("text");
      expect(blocks[2].type).toBe("image_url");
    });

    it("ignores video uploads (not supported)", () => {
      const service = new UploadInjectionService("test-jwt");
      const uploads = [
        { id: 1, media_type: "video", url: "https://example.com/vid.mp4", filename: "video.mp4" },
        { id: 2, media_type: "image", url: "https://example.com/img.png", filename: "img.png" },
      ];

      const blocks = (service as any).uploadsToContentBlocks(uploads);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe("image_url");
    });
  });

  describe("normalizeContent - content normalization", () => {
    it("wraps string content in a text block array", () => {
      const service = new UploadInjectionService("test-jwt");

      const result = (service as any).normalizeContent("Hello world");

      expect(result).toEqual([{ type: "text", text: "Hello world" }]);
    });

    it("returns array content unchanged", () => {
      const service = new UploadInjectionService("test-jwt");
      const content = [
        { type: "text", text: "Hello" },
        { type: "image_url", image_url: { url: "https://example.com/img.png" } },
      ];

      const result = (service as any).normalizeContent(content);

      expect(result).toEqual(content);
    });
  });

  describe("findLastHumanMessageIndex", () => {
    it("returns -1 for empty messages array", () => {
      const service = new UploadInjectionService("test-jwt");

      const result = (service as any).findLastHumanMessageIndex([]);

      expect(result).toBe(-1);
    });

    it("returns -1 when no human messages exist", () => {
      const service = new UploadInjectionService("test-jwt");
      const messages = [new AIMessage("AI only")];

      const result = (service as any).findLastHumanMessageIndex(messages);

      expect(result).toBe(-1);
    });

    it("finds the last human message index", () => {
      const service = new UploadInjectionService("test-jwt");
      const messages = [
        new HumanMessage("First"),
        new AIMessage("AI"),
        new HumanMessage("Last"),
      ];

      const result = (service as any).findLastHumanMessageIndex(messages);

      expect(result).toBe(2);
    });
  });
});
