import { z } from "zod";
import { tool } from "langchain";
import { getCurrentTaskInput } from "@langchain/langgraph";
import { type BrainstormGraphState } from "@state";
import { SocialLinksAPIService } from "@rails_api";
import { intentCommand } from "../shared";
import { brandIntent } from "@types";

const saveSocialLinksSchema = z.object({
  links: z
    .array(
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
    )
    .describe("Social media links to save for the project"),
});

/**
 * Tool for saving social media links when users provide them in chat.
 * Uses the existing SocialLinksAPIService.bulkUpsert to save links.
 */
export const saveSocialLinksTool = tool(
  async (args: z.infer<typeof saveSocialLinksSchema>, config) => {
    const state = getCurrentTaskInput<BrainstormGraphState>(config);
    const { projectId, jwt } = state;
    const toolCallId = config?.toolCall.id;

    if (!projectId || !jwt) {
      return intentCommand({
        toolCallId,
        toolName: "save_social_links",
        content: { success: false, error: "Missing projectId or authentication" },
      });
    }

    try {
      const service = new SocialLinksAPIService({ jwt });
      await service.bulkUpsert(projectId, args.links);

      const platforms = args.links.map((l) => l.platform).join(", ");
      return intentCommand({
        toolCallId,
        toolName: "save_social_links",
        content: {
          success: true,
          message: `Saved ${args.links.length} social link(s): ${platforms}`,
          links: args.links,
        },
        intents: [brandIntent("social_links_saved")],
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return intentCommand({
        toolCallId,
        toolName: "save_social_links",
        content: { success: false, error: `Failed to save social links: ${errorMessage}` },
      });
    }
  },
  {
    name: "save_social_links",
    description: `Save social media links for the project. Call this when the user provides
their social media URLs (Twitter, Instagram, LinkedIn, etc.) in the conversation.
For example: "Our Twitter is twitter.com/mybrand" or "Here are our social links..."`,
    schema: saveSocialLinksSchema,
  }
);
