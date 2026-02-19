import { z } from "zod";
import { tool } from "langchain";
import { getCurrentTaskInput } from "@langchain/langgraph";
import { type BrainstormGraphState } from "@state";
import { UploadsAPIService } from "@rails_api";
import { intentCommand } from "../shared";
import { brandIntent } from "@types";

const uploadProjectImagesSchema = z.object({
  urls: z
    .array(z.string())
    .optional()
    .describe(
      "Image URLs to associate with the project. Look for [Image URL: ...] annotations " +
        "in the conversation. If omitted, uses all images from the most recent message."
    ),
});

/**
 * Extracts all image URLs from the most recent human message that has images.
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
 * Tool for associating images sent in chat with the project's website.
 * Accepts optional URLs (from [Image URL: ...] annotations) or
 * falls back to extracting images from the most recent message.
 */
export const uploadProjectImagesTool = tool(
  async (args: z.infer<typeof uploadProjectImagesSchema>, config) => {
    const state = getCurrentTaskInput<BrainstormGraphState>(config);
    const { websiteId, jwt, messages } = state;
    const toolCallId = config?.toolCall.id;

    if (!websiteId || !jwt) {
      return intentCommand({
        toolCallId,
        toolName: "upload_project_images",
        content: { success: false, error: "Missing websiteId or authentication" },
      });
    }

    // Use provided URLs or extract from messages
    const imageUrls = args.urls?.length ? args.urls : extractImageUrls(messages || []);
    if (imageUrls.length === 0) {
      return intentCommand({
        toolCallId,
        toolName: "upload_project_images",
        content: {
          success: false,
          error: "No images found in recent messages. Ask the user to send their images.",
        },
      });
    }

    try {
      const service = new UploadsAPIService({ jwt });
      const results: Array<{
        url: string;
        success?: boolean;
        filename?: string;
        error?: string;
      }> = [];

      for (const url of imageUrls) {
        const filename = UploadsAPIService.extractFilenameFromUrl(url);
        if (!filename) {
          results.push({ url, error: "Could not extract filename from URL" });
          continue;
        }

        const upload = await service.findByFilename(filename);
        if (!upload) {
          results.push({ url, error: "Upload not found" });
          continue;
        }

        await service.update(upload.id, { websiteId });
        results.push({ url, success: true, filename: upload.filename });
      }

      const successCount = results.filter((r) => r.success).length;
      return intentCommand({
        toolCallId,
        toolName: "upload_project_images",
        content: {
          success: true,
          message: `Associated ${successCount} image(s) with your project.`,
          results,
        },
        intents: successCount > 0 ? [brandIntent("images_associated")] : undefined,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return intentCommand({
        toolCallId,
        toolName: "upload_project_images",
        content: { success: false, error: `Failed to associate images: ${errorMessage}` },
      });
    }
  },
  {
    name: "upload_project_images",
    description: `Associate images sent in the conversation with the project. Call this when the user sends product photos or images for their landing page. You can pass URLs from [Image URL: ...] annotations, or omit them to use all images from the most recent message.`,
    schema: uploadProjectImagesSchema,
  }
);
