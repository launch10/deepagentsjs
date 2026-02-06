import type { WebsiteGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { toStructuredMessage } from "langgraph-ai-sdk";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "@nodes";
import { createContextMessage } from "langgraph-ai-sdk";
import { isCacheModeEnabled } from "./cacheMode";
import { prepareContextWindow } from "./contextWindow";
import { getSchedulingToolMinorEditFiles } from "@cache";
import type { Website } from "@types";
import { injectAgentContext } from "@api/middleware";
import { getLogger } from "@core";

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

const cachedResponse = async (state: WebsiteGraphState) => {
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
    status: "completed" as const,
  };
};

const buildContext = async (state: WebsiteGraphState) => {
  const isFirstMessage = state.messages.length === 0;

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

  const allMessages = [...contextMessages, ...instructions];

  // Window for edit turns as a safety net (caps first-call token count).
  // compactConversation handles long-term summarization in the graph state.
  if (!isFirstMessage) {
    return prepareContextWindow(allMessages, { maxTurnPairs: 10, maxChars: 40_000 });
  }

  return allMessages;
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

    // In cache mode (create only), return cached files instead of running the agent
    if (isCacheModeEnabled(state)) {
      return await cachedResponse(state);
    }

    const isFirstMessage = state.messages.length === 0;
    const messages = await buildContext(state);

    const result = await createCodingAgent(
      { ...state, isFirstMessage },
      { messages, config }
    );

    // TODO: Visual Feedback Loop (post-MVP)
    // After the create flow completes, add a visual validation step:
    // 1. Take a screenshot of the generated page (via browserPool/puppeteer)
    // 2. Run a cheap vision model call: "Score this landing page 1-10 on visual quality.
    //    List top 3 issues if score < 7."
    // 3. If score < 7, inject the issues as a follow-up edit through singleShotEdit
    // 4. This creates a self-correcting loop: create → screenshot → evaluate → fix
    // Only applies to create flow (isFirstMessage), not edits.

    return result;
  }
);
