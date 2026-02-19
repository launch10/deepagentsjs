import { z } from "zod";
import { tool } from "langchain";
import { getCurrentTaskInput } from "@langchain/langgraph";
import { type BrainstormGraphState } from "@state";
import { UploadsAPIService } from "@rails_api";
import { intentCommand } from "../shared";
import { brandIntent } from "@types";

const setLogoSchema = z.object({
  url: z
    .string()
    .optional()
    .describe(
      "The image URL to set as the logo. Look for [Image URL: ...] annotations " +
        "in the conversation to find the correct URL. If omitted, uses the most recent image."
    ),
});

/**
 * Extracts image URLs from message content blocks.
 * Scans human messages in reverse order to find image_url blocks.
 */
function extractImageUrls(messages: any[]): string[] {
  const urls: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const type = msg?._getType?.() ?? msg?.getType?.();
    if (type !== "human") continue;

    const content = msg.content ?? msg.kwargs?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.type === "image_url" && block?.image_url?.url) {
        urls.push(block.image_url.url);
      }
    }
    if (urls.length > 0) break;
  }
  return urls;
}

/**
 * Tool for setting a user's logo from an image they sent in chat.
 * Accepts an optional URL (from [Image URL: ...] annotations) or
 * falls back to extracting the most recent image from the conversation.
 */
export const setLogoTool = tool(
  async (args: z.infer<typeof setLogoSchema>, config) => {
    const state = getCurrentTaskInput<BrainstormGraphState>(config);
    const { websiteId, jwt, messages } = state;
    const toolCallId = config?.toolCall.id;

    if (!websiteId || !jwt) {
      return intentCommand({
        toolCallId,
        toolName: "set_logo",
        content: { success: false, error: "Missing websiteId or authentication" },
      });
    }

    // Use provided URL or extract from messages
    let targetUrl = args.url;
    if (!targetUrl) {
      const imageUrls = extractImageUrls(messages || []);
      targetUrl = imageUrls[0];
    }

    if (!targetUrl) {
      return intentCommand({
        toolCallId,
        toolName: "set_logo",
        content: {
          success: false,
          error: "No images found in recent messages. Ask the user to send their logo image.",
        },
      });
    }

    try {
      const service = new UploadsAPIService({ jwt });

      const filename = UploadsAPIService.extractFilenameFromUrl(targetUrl);
      if (!filename) {
        return intentCommand({
          toolCallId,
          toolName: "set_logo",
          content: {
            success: false,
            error: "Could not extract filename from the image URL. The image may not be an uploaded file.",
          },
        });
      }

      const upload = await service.findByFilename(filename);
      if (!upload) {
        return intentCommand({
          toolCallId,
          toolName: "set_logo",
          content: { success: false, error: "Upload not found for the given image." },
        });
      }

      await service.update(upload.id, { isLogo: true, websiteId });

      return intentCommand({
        toolCallId,
        toolName: "set_logo",
        content: {
          success: true,
          message: `Logo set successfully. Image "${upload.filename}" is now your project logo.`,
          upload_id: upload.id,
        },
        intents: [brandIntent("logo_set")],
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return intentCommand({
        toolCallId,
        toolName: "set_logo",
        content: { success: false, error: `Failed to set logo: ${errorMessage}` },
      });
    }
  },
  {
    name: "set_logo",
    description: `Set an image as the project logo. Call this when the user sends an image and identifies it as their logo. You can pass the URL from the [Image URL: ...] annotation, or omit it to use the most recent image.`,
    schema: setLogoSchema,
  }
);
