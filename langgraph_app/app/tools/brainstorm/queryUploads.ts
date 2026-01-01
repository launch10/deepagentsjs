import { z } from "zod";
import { tool, ToolMessage } from "langchain";
import { getCurrentTaskInput, Command } from "@langchain/langgraph";
import { type BrainstormGraphState } from "@state";
import { UploadsAPIService } from "@rails_api";

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

      // Format for model consumption
      const formattedImages = UploadsAPIService.formatForModel(images);

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
          image_blocks: formattedImages,
        }),
        tool_call_id: config?.toolCall.id,
        name: "query_uploads",
      });
      return new Command({
        update: {
          messages: [toolMessage],
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
