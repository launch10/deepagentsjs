import { describe, it, expect } from "vitest";
import { summarizeEvents } from "@conversation";
import type { ContextEvent } from "@rails_api";

describe("summarizeEvents", () => {
  describe("with empty events", () => {
    it("returns empty array for empty input", () => {
      const result = summarizeEvents([]);
      expect(result).toEqual([]);
    });
  });

  describe("images summarizer", () => {
    it("summarizes single image upload with multimodal content", () => {
      const events: ContextEvent[] = [
        {
          id: 1,
          event_type: "images.created",
          payload: { upload_id: 100, filename: "hero.jpg", url: "https://example.com/hero.jpg" },
          created_at: "2026-02-03T12:00:00Z",
        },
      ];

      const result = summarizeEvents(events);

      expect(result).toHaveLength(1);
      expect(result[0]!.event_type).toBe("images");
      // 1 text block (intro + URL list) + 1 image_url block
      expect(result[0]!.content).toHaveLength(2);
      expect(result[0]!.content![0]).toEqual({
        type: "text",
        text: "I uploaded 1 image:\n- hero.jpg: https://example.com/hero.jpg\n\nUse these exact URLs in img src attributes.",
      });
      expect(result[0]!.content![1]).toEqual({
        type: "image_url",
        image_url: { url: "https://example.com/hero.jpg" },
      });
      expect(result[0]!.created_at).toBe("2026-02-03T12:00:00Z");
    });

    it("summarizes multiple image uploads with filenames and URLs", () => {
      const events: ContextEvent[] = [
        {
          id: 1,
          event_type: "images.created",
          payload: { upload_id: 100, filename: "hero.jpg", url: "https://example.com/hero.jpg" },
          created_at: "2026-02-03T12:00:00Z",
        },
        {
          id: 2,
          event_type: "images.created",
          payload: { upload_id: 101, filename: "product.png", url: "https://example.com/product.png" },
          created_at: "2026-02-03T12:01:00Z",
        },
        {
          id: 3,
          event_type: "images.created",
          payload: { upload_id: 102, filename: "logo.svg", url: "https://example.com/logo.svg" },
          created_at: "2026-02-03T12:02:00Z",
        },
      ];

      const result = summarizeEvents(events);

      expect(result).toHaveLength(1);
      // 1 text block + 3 image_url blocks
      expect(result[0]!.content).toHaveLength(4);
      expect(result[0]!.content![0]).toEqual({
        type: "text",
        text: "I uploaded 3 images:\n- hero.jpg: https://example.com/hero.jpg\n- product.png: https://example.com/product.png\n- logo.svg: https://example.com/logo.svg\n\nUse these exact URLs in img src attributes.",
      });
      expect(result[0]!.created_at).toBe("2026-02-03T12:02:00Z");
    });

    it("summarizes more than 3 image uploads with count and URLs", () => {
      const events: ContextEvent[] = [
        {
          id: 1,
          event_type: "images.created",
          payload: { filename: "a.jpg", url: "https://example.com/a.jpg" },
          created_at: "2026-02-03T12:00:00Z",
        },
        {
          id: 2,
          event_type: "images.created",
          payload: { filename: "b.jpg", url: "https://example.com/b.jpg" },
          created_at: "2026-02-03T12:01:00Z",
        },
        {
          id: 3,
          event_type: "images.created",
          payload: { filename: "c.jpg", url: "https://example.com/c.jpg" },
          created_at: "2026-02-03T12:02:00Z",
        },
        {
          id: 4,
          event_type: "images.created",
          payload: { filename: "d.jpg", url: "https://example.com/d.jpg" },
          created_at: "2026-02-03T12:03:00Z",
        },
      ];

      const result = summarizeEvents(events);

      expect(result).toHaveLength(1);
      // 1 text block + 4 image_url blocks
      expect(result[0]!.content).toHaveLength(5);
      expect(result[0]!.content![0]).toEqual({
        type: "text",
        text: "I uploaded 4 images:\n- a.jpg: https://example.com/a.jpg\n- b.jpg: https://example.com/b.jpg\n- c.jpg: https://example.com/c.jpg\n- d.jpg: https://example.com/d.jpg\n\nUse these exact URLs in img src attributes.",
      });
    });

    it("summarizes single image deletion", () => {
      const events: ContextEvent[] = [
        {
          id: 1,
          event_type: "images.deleted",
          payload: { upload_id: 100, filename: "old.jpg" },
          created_at: "2026-02-03T12:00:00Z",
        },
      ];

      const result = summarizeEvents(events);

      expect(result).toHaveLength(1);
      expect(result[0]!.content![0]).toEqual({
        type: "text",
        text: "I deleted 1 image: old.jpg. Please remove any references to these files.",
      });
    });

    it("summarizes multiple image deletions", () => {
      const events: ContextEvent[] = [
        {
          id: 1,
          event_type: "images.deleted",
          payload: { filename: "a.jpg" },
          created_at: "2026-02-03T12:00:00Z",
        },
        {
          id: 2,
          event_type: "images.deleted",
          payload: { filename: "b.jpg" },
          created_at: "2026-02-03T12:01:00Z",
        },
        {
          id: 3,
          event_type: "images.deleted",
          payload: { filename: "c.jpg" },
          created_at: "2026-02-03T12:02:00Z",
        },
      ];

      const result = summarizeEvents(events);

      expect(result).toHaveLength(1);
      expect(result[0]!.content![0]).toEqual({
        type: "text",
        text: "I deleted 3 images: a.jpg, b.jpg, c.jpg. Please remove any references to these files.",
      });
    });

    it("combines uploads and deletions in same summary", () => {
      const events: ContextEvent[] = [
        {
          id: 1,
          event_type: "images.created",
          payload: { filename: "new1.jpg", url: "https://example.com/new1.jpg" },
          created_at: "2026-02-03T12:00:00Z",
        },
        {
          id: 2,
          event_type: "images.deleted",
          payload: { filename: "old.jpg" },
          created_at: "2026-02-03T12:01:00Z",
        },
        {
          id: 3,
          event_type: "images.created",
          payload: { filename: "new2.jpg", url: "https://example.com/new2.jpg" },
          created_at: "2026-02-03T12:02:00Z",
        },
      ];

      const result = summarizeEvents(events);

      expect(result).toHaveLength(1);
      // 1 upload text + 2 image_url blocks + 1 deletion text = 4
      expect(result[0]!.content).toHaveLength(4);
      expect(result[0]!.content![0]).toEqual({
        type: "text",
        text: "I uploaded 2 images:\n- new1.jpg: https://example.com/new1.jpg\n- new2.jpg: https://example.com/new2.jpg\n\nUse these exact URLs in img src attributes.",
      });
      // image_url blocks at [1] and [2]
      expect(result[0]!.content![1]).toEqual({
        type: "image_url",
        image_url: { url: "https://example.com/new1.jpg" },
      });
      expect(result[0]!.content![3]).toEqual({
        type: "text",
        text: "I deleted 1 image: old.jpg. Please remove any references to these files.",
      });
    });

    it("handles many uploads with deletions", () => {
      const events: ContextEvent[] = [
        {
          id: 1,
          event_type: "images.created",
          payload: { filename: "a.jpg", url: "https://example.com/a.jpg" },
          created_at: "2026-02-03T12:00:00Z",
        },
        {
          id: 2,
          event_type: "images.created",
          payload: { filename: "b.jpg", url: "https://example.com/b.jpg" },
          created_at: "2026-02-03T12:01:00Z",
        },
        {
          id: 3,
          event_type: "images.created",
          payload: { filename: "c.jpg", url: "https://example.com/c.jpg" },
          created_at: "2026-02-03T12:02:00Z",
        },
        {
          id: 4,
          event_type: "images.created",
          payload: { filename: "d.jpg", url: "https://example.com/d.jpg" },
          created_at: "2026-02-03T12:03:00Z",
        },
        {
          id: 5,
          event_type: "images.deleted",
          payload: { filename: "old1.jpg" },
          created_at: "2026-02-03T12:04:00Z",
        },
        {
          id: 6,
          event_type: "images.deleted",
          payload: { filename: "old2.jpg" },
          created_at: "2026-02-03T12:05:00Z",
        },
      ];

      const result = summarizeEvents(events);

      expect(result).toHaveLength(1);
      // 1 upload text + 4 image_url blocks + 1 deletion text = 6
      expect(result[0]!.content).toHaveLength(6);
      expect(result[0]!.content![0]).toEqual({
        type: "text",
        text: "I uploaded 4 images:\n- a.jpg: https://example.com/a.jpg\n- b.jpg: https://example.com/b.jpg\n- c.jpg: https://example.com/c.jpg\n- d.jpg: https://example.com/d.jpg\n\nUse these exact URLs in img src attributes.",
      });
      expect(result[0]!.content![5]).toEqual({
        type: "text",
        text: "I deleted 2 images: old1.jpg, old2.jpg. Please remove any references to these files.",
      });
    });
  });

  describe("default summarizer", () => {
    it("uses default summarizer for unknown event types", () => {
      const events: ContextEvent[] = [
        {
          id: 1,
          event_type: "theme.updated",
          payload: { theme_id: 5, name: "Ocean" },
          created_at: "2026-02-03T12:00:00Z",
        },
      ];

      const result = summarizeEvents(events);

      expect(result).toHaveLength(1);
      // Default summarizer uses the full event_type, not the category
      expect(result[0]!.event_type).toBe("theme.updated");
      expect(result[0]!.message).toContain("theme.updated");
      expect(result[0]!.message).toContain("Ocean");
    });
  });

  describe("event grouping", () => {
    it("groups events by category", () => {
      const events: ContextEvent[] = [
        {
          id: 1,
          event_type: "images.created",
          payload: { filename: "a.jpg", url: "https://example.com/a.jpg" },
          created_at: "2026-02-03T12:00:00Z",
        },
        {
          id: 2,
          event_type: "theme.updated",
          payload: { name: "Ocean" },
          created_at: "2026-02-03T12:01:00Z",
        },
        {
          id: 3,
          event_type: "images.deleted",
          payload: { filename: "b.jpg" },
          created_at: "2026-02-03T12:02:00Z",
        },
      ];

      const result = summarizeEvents(events);

      expect(result).toHaveLength(2);
      // images.* events are grouped under "images" category
      // theme.updated falls through to default summarizer (no theme summarizer exists)
      const imagesSummary = result.find((s) => s.event_type === "images");
      const themeSummary = result.find((s) => s.event_type === "theme.updated");

      expect(imagesSummary).toBeDefined();
      expect(themeSummary).toBeDefined();
    });

    it("sorts summaries by last event timestamp", () => {
      const events: ContextEvent[] = [
        {
          id: 1,
          event_type: "theme.updated",
          payload: { name: "Ocean" },
          created_at: "2026-02-03T12:03:00Z",
        },
        {
          id: 2,
          event_type: "images.created",
          payload: { filename: "a.jpg", url: "https://example.com/a.jpg" },
          created_at: "2026-02-03T12:01:00Z",
        },
      ];

      const result = summarizeEvents(events);

      expect(result).toHaveLength(2);
      expect(result[0]!.event_type).toBe("images"); // Earlier timestamp
      expect(result[1]!.event_type).toBe("theme.updated"); // Later timestamp (default summarizer keeps full type)
    });
  });
});
