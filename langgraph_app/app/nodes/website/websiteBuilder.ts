import type { WebsiteGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { toStructuredMessage } from "langgraph-ai-sdk";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "@nodes";
import { createMultimodalContextMessage, createContextMessage } from "langgraph-ai-sdk";
import { isCacheModeEnabled } from "./cacheMode";
import { getSchedulingToolMinorEditFiles } from "@cache";
import type { Website } from "@types";
import { db, websiteFiles, eq } from "@db";

/**
 * Get cached response for cache mode.
 * Returns files and message for the create flow.
 */
function getCachedResponse(): {
  files: Website.FileMap;
  message: string;
} {
  return {
    files: getSchedulingToolMinorEditFiles(),
    message: "I've updated the headline and subtitle on your landing page to be more compelling.",
  };
}

const buildBrainstormContext = (state: WebsiteGraphState) => {
  const contextContent = `
      ## Brainstorm Context
      - Idea: ${state.brainstorm.idea || "Not provided"}
      - Audience: ${state.brainstorm.audience || "Not provided"}
      - Solution: ${state.brainstorm.solution || "Not provided"}
      - Social Proof: ${state.brainstorm.socialProof || "Not provided"}

      ## Theme
      ${state.theme ? `Using theme: ${state.theme.name}` : "Using default theme"}

      ## Images
      ${state.images.length > 0 ? state.images.map((img) => `- ${img.url}${img.isLogo ? " (logo)" : ""}`).join("\n") : "No images uploaded"}

      Please create a landing page based on this context.
    `;

  // Build context message - combine context with visual images if available
  const contextMessage =
    state.images.length > 0
      ? createMultimodalContextMessage([
          { type: "text" as const, text: contextContent },
          ...state.images.map((img) => ({
            type: "image_url" as const,
            image_url: { url: img.url },
          })),
        ])
      : { role: "user", content: contextContent };

  return contextMessage;
};

export const websiteBuilderNode = NodeMiddleware.use(
  {},
  async (
    state: WebsiteGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    if (!state.websiteId || !state.jwt) {
      throw new Error("websiteId and jwt are required");
    }

    // In cache mode, return cached files instead of running the agent
    if (isCacheModeEnabled()) {
      const { files, message } = getCachedResponse();

      const rawMessage = new AIMessage({
        content: message,
        id: `cache-mode-create-${Date.now()}`,
      });

      const [aiMessage] = await toStructuredMessage(rawMessage);
      const messages = (state.messages || []).length === 0 ? [aiMessage] : state.messages;

      return {
        messages,
        files,
        status: "completed",
      };
    }

    // Detect if this is a new site or an edit by checking files in database
    // We can't rely on state.files as files are loaded by the backend, not checkpoint
    const existingFiles = await db
      .select({ id: websiteFiles.id })
      .from(websiteFiles)
      .where(eq(websiteFiles.websiteId, state.websiteId))
      .limit(1);
    const hasExistingFiles = existingFiles.length > 0;
    const isFirstMessage = !hasExistingFiles;

    const agent = await createCodingAgent({ ...state, isFirstMessage });
    const brainstormContext = buildBrainstormContext(state);

    // Use different context based on whether this is create or edit
    const contextMessages = isFirstMessage
      ? [createContextMessage("Create a landing page for this business"), brainstormContext]
      : []; // For edits, just use the user's message directly

    const result = await agent.invoke(
      {
        messages: [...(state.messages || []), ...contextMessages],
      },
      {
        ...config,
        recursionLimit: 150,
      }
    );

    return {
      messages: result.messages,
      status: "completed",
    };
  }
);
