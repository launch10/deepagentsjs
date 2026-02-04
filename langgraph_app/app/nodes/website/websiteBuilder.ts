import type { WebsiteGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { toStructuredMessage } from "langgraph-ai-sdk";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "@nodes";
import { createContextMessage } from "langgraph-ai-sdk";
import { isCacheModeEnabled } from "./cacheMode";
import { getSchedulingToolMinorEditFiles } from "@cache";
import type { Website } from "@types";
import { injectAgentContext } from "@api/middleware";

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

    const isFirstMessage = state.messages.length === 0;
    const agent = await createCodingAgent({ ...state, isFirstMessage });

    // Inject context events (brainstorm.finished, images.created, images.deleted)
    // This runs within AsyncLocalStorage context, preserving Polly.js caching
    // For the first message (create flow), this will include brainstorm context from events
    const contextMessages =
      state.projectId && state.jwt
        ? await injectAgentContext({
            graphName: "website",
            projectId: state.projectId,
            jwt: state.jwt,
            messages: state.messages || [],
          })
        : state.messages || [];

    // For create flow, add instruction to create a landing page
    // Brainstorm context and images come from events via injectAgentContext
    const instructions = isFirstMessage
      ? [createContextMessage("Create a landing page for this business")]
      : []; // For edits, just use the user's message directly

    const result = await agent.invoke(
      {
        messages: [...contextMessages, ...instructions],
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
