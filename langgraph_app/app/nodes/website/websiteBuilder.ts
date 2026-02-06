import type { WebsiteGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { toStructuredMessage } from "langgraph-ai-sdk";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent, singleShotEdit, classifyEditWithLLM } from "@nodes";
import { buildFileTree } from "@nodes";
import { createContextMessage } from "langgraph-ai-sdk";
import { isCacheModeEnabled } from "./cacheMode";
import { getSchedulingToolMinorEditFiles } from "@cache";
import { lastAIMessage, type Website } from "@types";
import { injectAgentContext } from "@api/middleware";
import { getCodingAgentBackend } from "@nodes";

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

/**
 * Determine if this request needs the full agent or can use single-shot.
 *
 * - First message (create flow) → always full agent
 * - Console errors (bugfix) → always full agent
 * - Otherwise → cheap LLM classifier decides
 */
const shouldUseSingleShot = async (state: WebsiteGraphState): Promise<boolean> => {
  const isFirstMessage = state.messages.length === 0;

  // Create flow or bugfix → full agent, no question
  if (isFirstMessage || (state.consoleErrors && state.consoleErrors.length > 0)) {
    return false;
  }

  // Use cheap LLM to classify: does this need many files / lots of changes?
  const lastMessage = state.messages.at(-1);
  const userText = typeof lastMessage?.content === "string" ? lastMessage.content : "";

  // Get file tree for the classifier (lightweight — just paths, no contents)
  const backend = await getCodingAgentBackend(state);
  const { tree } = await buildFileTree(backend);

  const route = await classifyEditWithLLM(userText, tree);
  console.log(`Edit classified as: ${route}`);

  return route === "simple";
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

  return [...contextMessages, ...instructions];
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
      return await cachedResponse(state);
    }

    const messages = await buildContext(state);
    const useSingleShot = await shouldUseSingleShot(state);

    if (useSingleShot) {
      console.log("Using single-shot edit path");
      return await singleShotEdit(state, messages);
    }

    // Full agent path: create flow, bugfix, or complex edits
    console.log("Using full agent path");
    const isFirstMessage = state.messages.length === 0;
    const agent = await createCodingAgent({ ...state, isFirstMessage });

    const result = await agent.invoke(
      { messages },
      {
        ...config,
        recursionLimit: 150,
      }
    );

    // Only return user-visible messages to the outer graph.
    // The deep agent maintains its own checkpoint with full internal context.
    const lastAI = lastAIMessage(result);
    const [structuredMessage] = lastAI ? await toStructuredMessage(lastAI) : [undefined];

    return {
      messages: structuredMessage ? [structuredMessage] : [],
      status: "completed" as const,
    };
  }
);
