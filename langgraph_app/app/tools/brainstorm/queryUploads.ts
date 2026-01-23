import { z } from "zod";
import { tool, ToolMessage } from "langchain";
import { getCurrentTaskInput, Command } from "@langchain/langgraph";
import { type BrainstormGraphState } from "@state";
import { UploadsAPIService } from "@rails_api";
import { createMultimodalContextMessage } from "langgraph-ai-sdk";

const queryUploadsSchema = z.object({
  query_type: z
    .enum(["recent", "logos", "all"])
    .describe(
      "Type of images to query: 'recent' for most recent product images, 'logos' for logo images only, 'all' for all images"
    ),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of images to return. Defaults to 10."),
});

type QueryUploadsInput = z.infer<typeof queryUploadsSchema>;

/**
 * Tool for querying user's uploaded images.
 * Use this when the user mentions images they've uploaded previously
 * but aren't attached to the current message.
 */
export const queryUploadsTool = tool(
  async (args: QueryUploadsInput, config) => {
    const state = getCurrentTaskInput<BrainstormGraphState>(config);
    const { websiteId, jwt } = state;

    if (!websiteId) {
      const toolMessage = new ToolMessage({
        content: JSON.stringify({
          success: false,
          error: "No website associated with this brainstorm session",
          images: [],
        }),
        tool_call_id: config?.toolCall.id,
        name: "query_uploads",
      });
      return new Command({
        update: {
          messages: [toolMessage],
        },
      });
    }

    if (!jwt) {
      const toolMessage = new ToolMessage({
        content: JSON.stringify({
          success: false,
          error: "Authentication required to query uploads",
          images: [],
        }),
        tool_call_id: config?.toolCall.id,
        name: "query_uploads",
      });
      return new Command({
        update: {
          messages: [toolMessage],
        },
      });
    }

    try {
      const service = new UploadsAPIService({ jwt });
      const limit = args.limit || 10;

      let images;
      switch (args.query_type) {
        case "logos":
          images = await service.findLogos({ websiteId, limit });
          break;
        case "recent":
          images = await service.findRecent({ websiteId, limit });
          break;
        case "all":
        default:
          images = await service.findRecent({ websiteId, limit, includeLogos: true });
          break;
      }

      // Format for model consumption - creates { type: "image_url", image_url: { url: "..." } } blocks
      const formattedImages = UploadsAPIService.formatForModel(images);

      // ToolMessage provides metadata about what was fetched
      const toolMessage = new ToolMessage({
        content: JSON.stringify({
          success: true,
          count: images.length,
          images: images.map((img) => ({
            url: img.url,
            filename: img.filename,
            is_logo: img.is_logo,
            created_at: img.created_at,
          })),
        }),
        tool_call_id: config?.toolCall.id,
        name: "query_uploads",
      });

      // If we have images, inject a context message with the actual image blocks
      // so Claude can "see" the images (not just read URLs as text).
      // Context messages are preserved in state for tracing and filtered at the SDK presentation layer.
      const messages: ToolMessage[] = [toolMessage];
      const contextMessage =
        images.length > 0
          ? createMultimodalContextMessage([
              {
                type: "text" as const,
                text: `Here are the ${images.length} image(s) you requested:`,
              },
              ...formattedImages,
            ])
          : null;

      return new Command({
        update: {
          messages: contextMessage ? [...messages, contextMessage] : messages,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const toolMessage = new ToolMessage({
        content: JSON.stringify({
          success: false,
          error: `Failed to query uploads: ${errorMessage}`,
          images: [],
        }),
        tool_call_id: config?.toolCall.id,
        name: "query_uploads",
      });
      return new Command({
        update: {
          messages: [toolMessage],
        },
      });
    }
  },
  {
    name: "query_uploads",
    description: `Query the user's uploaded images for this project.
Use this tool when the user mentions images they've uploaded previously but aren't
attached to the current message. For example:
- "Use the product photos I uploaded earlier"
- "Can you see my recent image uploads?"
- "Use the logo I uploaded"

Returns a list of uploaded images with their URLs and metadata.`,
    schema: queryUploadsSchema,
  }
);
