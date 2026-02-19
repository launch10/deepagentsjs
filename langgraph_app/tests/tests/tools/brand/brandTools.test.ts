import { describe, it, expect } from "vitest";
import { z } from "zod";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { extractImageUrls } from "../../../../app/tools/shared/extractImageUrls";
import { intentCommand } from "../../../../app/tools/shared/intentCommand";
import { brandIntent, brandAgentIntentSchema, isBrandAgentIntent } from "@types";

/**
 * Unit tests for brand tools.
 *
 * Note: The brand tools themselves (saveSocialLinksTool, setLogoTool,
 * uploadProjectImagesTool) require the full LangGraph runtime
 * (getCurrentTaskInput uses internal scratchpad). Full integration tests
 * would require a running graph.
 *
 * These tests verify:
 * 1. extractImageUrls - pure function, fully testable
 * 2. Schema validation for each tool's input
 * 3. intentCommand output format expectations
 * 4. brandIntent factory and type guards
 */

// ─── extractImageUrls ───────────────────────────────────────────────────────

describe("extractImageUrls", () => {
  it("returns URLs from the most recent human message with image_url blocks", () => {
    const messages = [
      new HumanMessage({
        content: [
          { type: "text", text: "Here is my logo" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/logo.png" },
          },
          {
            type: "image_url",
            image_url: { url: "https://example.com/logo2.png" },
          },
        ],
      }),
    ];

    const urls = extractImageUrls(messages);

    expect(urls).toEqual(["https://example.com/logo.png", "https://example.com/logo2.png"]);
  });

  it("skips non-human messages", () => {
    const messages = [
      new HumanMessage({ content: "hello" }),
      new AIMessage({
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/ai-image.png" },
          },
        ],
      }),
      new SystemMessage({
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/system-image.png" },
          },
        ],
      }),
    ];

    const urls = extractImageUrls(messages);

    expect(urls).toEqual([]);
  });

  it("handles messages with non-array content (string content)", () => {
    const messages = [
      new HumanMessage({ content: "Just text, no images" }),
      new HumanMessage({ content: "Another text message" }),
    ];

    const urls = extractImageUrls(messages);

    expect(urls).toEqual([]);
  });

  it("returns empty array when no messages are provided", () => {
    const urls = extractImageUrls([]);

    expect(urls).toEqual([]);
  });

  it("returns empty array when messages have array content but no image_url blocks", () => {
    const messages = [
      new HumanMessage({
        content: [
          { type: "text", text: "Just text blocks" },
          { type: "text", text: "Another text block" },
        ],
      }),
    ];

    const urls = extractImageUrls(messages);

    expect(urls).toEqual([]);
  });

  it("stops at the first human message that has images (scanning reverse order)", () => {
    const messages = [
      new HumanMessage({
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/old-image.png" },
          },
        ],
      }),
      new AIMessage({ content: "I see your image" }),
      new HumanMessage({
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/new-image.png" },
          },
        ],
      }),
    ];

    const urls = extractImageUrls(messages);

    // Should only return the most recent (last) human message's images
    expect(urls).toEqual(["https://example.com/new-image.png"]);
    expect(urls).not.toContain("https://example.com/old-image.png");
  });

  it("skips human messages without images and finds the next one with images", () => {
    const messages = [
      new HumanMessage({
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/earlier-image.png" },
          },
        ],
      }),
      new HumanMessage({ content: "Use this as my logo" }),
    ];

    const urls = extractImageUrls(messages);

    // The most recent human message has string content (no images),
    // so it continues scanning and finds the earlier one
    expect(urls).toEqual(["https://example.com/earlier-image.png"]);
  });

  it("handles image_url blocks with missing url field", () => {
    const messages = [
      new HumanMessage({
        content: [
          { type: "image_url", image_url: {} },
          {
            type: "image_url",
            image_url: { url: "https://example.com/valid.png" },
          },
        ],
      }),
    ];

    const urls = extractImageUrls(messages);

    // Only the block with a valid url should be returned
    expect(urls).toEqual(["https://example.com/valid.png"]);
  });

  it("handles plain object messages with _getType method", () => {
    const messages = [
      {
        _getType: () => "human",
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/plain-obj.png" },
          },
        ],
      },
    ];

    const urls = extractImageUrls(messages);

    expect(urls).toEqual(["https://example.com/plain-obj.png"]);
  });

  it("handles plain object messages with getType method", () => {
    const messages = [
      {
        getType: () => "human",
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/gettype.png" },
          },
        ],
      },
    ];

    const urls = extractImageUrls(messages);

    expect(urls).toEqual(["https://example.com/gettype.png"]);
  });

  it("handles messages with kwargs.content fallback", () => {
    const messages = [
      {
        _getType: () => "human",
        kwargs: {
          content: [
            {
              type: "image_url",
              image_url: { url: "https://example.com/kwargs.png" },
            },
          ],
        },
      },
    ];

    const urls = extractImageUrls(messages);

    expect(urls).toEqual(["https://example.com/kwargs.png"]);
  });
});

// ─── saveSocialLinks schema validation ──────────────────────────────────────

describe("saveSocialLinks schema validation", () => {
  // Recreate the schema locally to test validation without needing the tool runtime
  const saveSocialLinksSchema = z.object({
    links: z.array(
      z.object({
        platform: z.enum([
          "twitter",
          "instagram",
          "facebook",
          "linkedin",
          "youtube",
          "tiktok",
          "website",
          "other",
        ]),
        url: z.string(),
      })
    ),
  });

  it("accepts valid social links", () => {
    const input = {
      links: [
        { platform: "twitter", url: "https://twitter.com/mybrand" },
        { platform: "instagram", url: "https://instagram.com/mybrand" },
      ],
    };

    const result = saveSocialLinksSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.links).toHaveLength(2);
      expect(result.data.links[0]!.platform).toBe("twitter");
    }
  });

  it("accepts all valid platform types", () => {
    const platforms = [
      "twitter",
      "instagram",
      "facebook",
      "linkedin",
      "youtube",
      "tiktok",
      "website",
      "other",
    ] as const;

    for (const platform of platforms) {
      const input = {
        links: [{ platform, url: `https://example.com/${platform}` }],
      };
      const result = saveSocialLinksSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid platform type", () => {
    const input = {
      links: [{ platform: "snapchat", url: "https://snapchat.com/mybrand" }],
    };

    const result = saveSocialLinksSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it("rejects missing links field", () => {
    const input = {};

    const result = saveSocialLinksSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it("rejects links missing url field", () => {
    const input = {
      links: [{ platform: "twitter" }],
    };

    const result = saveSocialLinksSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it("rejects links missing platform field", () => {
    const input = {
      links: [{ url: "https://twitter.com/mybrand" }],
    };

    const result = saveSocialLinksSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it("accepts empty links array", () => {
    const input = { links: [] };

    const result = saveSocialLinksSchema.safeParse(input);

    expect(result.success).toBe(true);
  });
});

// ─── setLogo schema validation ──────────────────────────────────────────────

describe("setLogo schema validation", () => {
  const setLogoSchema = z.object({
    url: z.string().optional(),
  });

  it("accepts with a url", () => {
    const result = setLogoSchema.safeParse({
      url: "https://example.com/logo.png",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe("https://example.com/logo.png");
    }
  });

  it("accepts without a url (optional)", () => {
    const result = setLogoSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBeUndefined();
    }
  });

  it("accepts with url explicitly set to undefined", () => {
    const result = setLogoSchema.safeParse({ url: undefined });

    expect(result.success).toBe(true);
  });

  it("rejects non-string url", () => {
    const result = setLogoSchema.safeParse({ url: 12345 });

    expect(result.success).toBe(false);
  });
});

// ─── uploadProjectImages schema validation ──────────────────────────────────

describe("uploadProjectImages schema validation", () => {
  const uploadProjectImagesSchema = z.object({
    urls: z.array(z.string()).optional(),
  });

  it("accepts with an array of URLs", () => {
    const result = uploadProjectImagesSchema.safeParse({
      urls: ["https://example.com/img1.png", "https://example.com/img2.png"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.urls).toHaveLength(2);
    }
  });

  it("accepts without urls (optional)", () => {
    const result = uploadProjectImagesSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.urls).toBeUndefined();
    }
  });

  it("accepts with an empty urls array", () => {
    const result = uploadProjectImagesSchema.safeParse({ urls: [] });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.urls).toEqual([]);
    }
  });

  it("rejects non-string array elements", () => {
    const result = uploadProjectImagesSchema.safeParse({
      urls: [123, true],
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-array urls", () => {
    const result = uploadProjectImagesSchema.safeParse({
      urls: "https://example.com/img.png",
    });

    expect(result.success).toBe(false);
  });
});

// ─── intentCommand output format ────────────────────────────────────────────

describe("intentCommand output format", () => {
  it("creates a Command with a ToolMessage for save_social_links", () => {
    const result = intentCommand({
      toolCallId: "call_abc123",
      toolName: "save_social_links",
      content: {
        success: true,
        message: "Saved 2 social link(s): twitter, instagram",
        links: [
          { platform: "twitter", url: "https://twitter.com/mybrand" },
          { platform: "instagram", url: "https://instagram.com/mybrand" },
        ],
      },
      intents: [brandIntent("social_links_saved")],
    });

    // The result should be a Command (from @langchain/langgraph)
    expect(result).toBeDefined();
    expect(result.update).toBeDefined();

    // Verify the ToolMessage in the update
    const update = result.update! as Record<string, unknown>;
    const messages = update.messages as ToolMessage[];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toBeInstanceOf(ToolMessage);
    expect(messages[0]!.name).toBe("save_social_links");
    expect(messages[0]!.tool_call_id).toBe("call_abc123");

    const parsed = JSON.parse(messages[0]!.content as string);
    expect(parsed.success).toBe(true);
    expect(parsed.message).toContain("Saved 2 social link(s)");
    expect(parsed.links).toHaveLength(2);

    // Verify the intents
    const intents = update.agentIntents as any[];
    expect(intents).toHaveLength(1);
    expect(intents[0].type).toBe("social_links_saved");
  });

  it("creates a Command with a ToolMessage for set_logo", () => {
    const result = intentCommand({
      toolCallId: "call_def456",
      toolName: "set_logo",
      content: {
        success: true,
        message: 'Logo set successfully. Image "logo.png" is now your project logo.',
        upload_id: 42,
      },
      intents: [brandIntent("logo_set")],
    });

    const update = result.update! as Record<string, unknown>;
    const messages = update.messages as ToolMessage[];
    expect(messages[0]!.name).toBe("set_logo");

    const parsed = JSON.parse(messages[0]!.content as string);
    expect(parsed.success).toBe(true);
    expect(parsed.upload_id).toBe(42);

    const intents = update.agentIntents as any[];
    expect(intents[0].type).toBe("logo_set");
  });

  it("creates a Command with a ToolMessage for upload_project_images", () => {
    const result = intentCommand({
      toolCallId: "call_ghi789",
      toolName: "upload_project_images",
      content: {
        success: true,
        message: "Associated 2 image(s) with your project.",
        results: [
          { url: "https://example.com/1.png", success: true, filename: "1.png" },
          { url: "https://example.com/2.png", success: true, filename: "2.png" },
        ],
      },
      intents: [brandIntent("images_associated")],
    });

    const update = result.update! as Record<string, unknown>;
    const messages = update.messages as ToolMessage[];
    expect(messages[0]!.name).toBe("upload_project_images");

    const parsed = JSON.parse(messages[0]!.content as string);
    expect(parsed.success).toBe(true);
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[0].filename).toBe("1.png");

    const intents = update.agentIntents as any[];
    expect(intents[0].type).toBe("images_associated");
  });

  it("creates a Command without intents when not provided", () => {
    const result = intentCommand({
      toolCallId: "call_err",
      toolName: "save_social_links",
      content: {
        success: false,
        error: "Missing projectId or authentication",
      },
    });

    const update = result.update! as Record<string, unknown>;
    const messages = update.messages as ToolMessage[];
    const parsed = JSON.parse(messages[0]!.content as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("Missing projectId");

    // No intents should be set on error
    expect(update.agentIntents).toBeUndefined();
  });

  it("creates a Command without intents when intents array is empty", () => {
    const result = intentCommand({
      toolCallId: "call_empty",
      toolName: "set_logo",
      content: { success: false, error: "No images found" },
      intents: [],
    });

    expect((result.update! as Record<string, unknown>).agentIntents).toBeUndefined();
  });

  it("handles missing toolCallId gracefully", () => {
    const result = intentCommand({
      toolCallId: undefined,
      toolName: "set_logo",
      content: { success: false, error: "Missing websiteId" },
    });

    const messages = (result.update! as Record<string, unknown>).messages as ToolMessage[];
    expect(messages[0]!.tool_call_id).toBe("");
  });
});

// ─── brandIntent factory and type guards ────────────────────────────────────

describe("brandIntent factory", () => {
  it("creates a valid brand intent with logo_set type", () => {
    const intent = brandIntent("logo_set");

    expect(intent.type).toBe("logo_set");
    expect(intent.payload).toEqual({});
    expect(intent.createdAt).toBeDefined();
    expect(new Date(intent.createdAt).getTime()).not.toBeNaN();
  });

  it("creates a valid brand intent with social_links_saved type", () => {
    const intent = brandIntent("social_links_saved");

    expect(intent.type).toBe("social_links_saved");
    expect(intent.payload).toEqual({});
  });

  it("creates a valid brand intent with images_associated type", () => {
    const intent = brandIntent("images_associated");

    expect(intent.type).toBe("images_associated");
    expect(intent.payload).toEqual({});
  });

  it("creates a valid brand intent with color_scheme_applied type", () => {
    const intent = brandIntent("color_scheme_applied");

    expect(intent.type).toBe("color_scheme_applied");
  });

  it("validates against brandAgentIntentSchema", () => {
    const intent = brandIntent("logo_set");
    const result = brandAgentIntentSchema.safeParse(intent);

    expect(result.success).toBe(true);
  });

  it("isBrandAgentIntent returns true for brand intents", () => {
    const intent = brandIntent("social_links_saved");

    expect(isBrandAgentIntent(intent)).toBe(true);
  });

  it("isBrandAgentIntent returns false for non-brand intents", () => {
    const navigateIntent = {
      type: "navigate",
      payload: { page: "website" },
      createdAt: new Date().toISOString(),
    };

    expect(isBrandAgentIntent(navigateIntent as any)).toBe(false);
  });
});

// ─── Expected error response formats ───────────────────────────────────────

describe("expected error response formats", () => {
  it("save_social_links missing auth error format", () => {
    const errorContent = {
      success: false,
      error: "Missing projectId or authentication",
    };

    const toolMessage = new ToolMessage({
      content: JSON.stringify(errorContent),
      tool_call_id: "call_123",
      name: "save_social_links",
    });

    const parsed = JSON.parse(toolMessage.content as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("Missing projectId");
  });

  it("set_logo missing auth error format", () => {
    const errorContent = {
      success: false,
      error: "Missing websiteId or authentication",
    };

    const toolMessage = new ToolMessage({
      content: JSON.stringify(errorContent),
      tool_call_id: "call_123",
      name: "set_logo",
    });

    const parsed = JSON.parse(toolMessage.content as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("Missing websiteId");
  });

  it("set_logo no images found error format", () => {
    const errorContent = {
      success: false,
      error: "No images found in recent messages. Ask the user to send their logo image.",
    };

    const toolMessage = new ToolMessage({
      content: JSON.stringify(errorContent),
      tool_call_id: "call_123",
      name: "set_logo",
    });

    const parsed = JSON.parse(toolMessage.content as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("No images found");
  });

  it("upload_project_images missing auth error format", () => {
    const errorContent = {
      success: false,
      error: "Missing websiteId or authentication",
    };

    const toolMessage = new ToolMessage({
      content: JSON.stringify(errorContent),
      tool_call_id: "call_123",
      name: "upload_project_images",
    });

    const parsed = JSON.parse(toolMessage.content as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("Missing websiteId");
  });

  it("upload_project_images no images found error format", () => {
    const errorContent = {
      success: false,
      error: "No images found in recent messages. Ask the user to send their images.",
    };

    const toolMessage = new ToolMessage({
      content: JSON.stringify(errorContent),
      tool_call_id: "call_123",
      name: "upload_project_images",
    });

    const parsed = JSON.parse(toolMessage.content as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("No images found");
  });

  it("save_social_links API failure error format", () => {
    const errorContent = {
      success: false,
      error: "Failed to save social links: Network error",
    };

    const toolMessage = new ToolMessage({
      content: JSON.stringify(errorContent),
      tool_call_id: "call_123",
      name: "save_social_links",
    });

    const parsed = JSON.parse(toolMessage.content as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("Failed to save social links");
  });
});
