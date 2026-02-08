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
import { db, codeFiles, websiteFiles, eq } from "@db";

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
 * Create flow = no AI messages yet and no existing files. Handles both:
 * - Production: 0 messages in state
 * - Eval/test: 1 HumanMessage passed for input control
 */
const isCreateFlow = async (state: WebsiteGraphState) => {
  const hasAiMessage = state.messages.some((m) => m._getType() === "ai");
  if (hasAiMessage) return false;

  const hasFiles = await hasWebsiteFiles(state);
  return !hasFiles;
};

const hasWebsiteFiles = async (state: WebsiteGraphState): Promise<boolean> => {
  const rows = await db
    .select()
    .from(websiteFiles)
    .where(eq(websiteFiles.websiteId!, state.websiteId!))
    .limit(1);
  return rows.length > 0;
};

const buildContext = async (state: WebsiteGraphState) => {
  const isCreate = await isCreateFlow(state);

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
  const instructions = isCreate
    ? [createContextMessage("Create a landing page for this business")]
    : []; // For edits, just use the user's message directly

  const allMessages = [...contextMessages, ...instructions];

  // Window for edit turns as a safety net (caps first-call token count).
  // compactConversation handles long-term summarization in the graph state.
  if (!isCreate) {
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
    const cacheEnabled = isCacheModeEnabled(state);
    const isCreate = await isCreateFlow(state);

    if (cacheEnabled) {
      getLogger().info("Cache mode enabled, returning cached files");
      return await cachedResponse(state);
    }

    // Guard: if there's no human message in context (e.g., a stateOnly call that
    // routed to the default path with no intent and no user input), skip the agent.
    // Without this, the LLM sees only prior AI messages, enters a degenerate
    // repetition loop, and appends junk to the checkpoint on every page load.
    const hasHumanMessage = state.messages.some((m) => m._getType() === "human");
    if (!isCreate && !hasHumanMessage) {
      getLogger().info("No human message in context, skipping websiteBuilder");
      return {};
    }

    const messages = await buildContext(state);

    const result = await createCodingAgent(
      { ...state, isCreateFlow: isCreate },
      {
        messages,
        config,
        recursionLimit: isCreate ? 150 : 100,
      }
    );

    // TODO: Visual Feedback Loop (post-MVP)
    // After the create flow completes, add a visual validation step:
    // 1. Take a screenshot of the generated page (via browserPool/puppeteer)
    // 2. Run a cheap vision model call: "Score this landing page 1-10 on visual quality.
    //    List top 3 issues if score < 7."
    // 3. If score < 7, inject the issues as a follow-up edit through singleShotEdit
    // 4. This creates a self-correcting loop: create → screenshot → evaluate → fix
    // Only applies to create flow (isCreateFlow), not edits.

    // Read files from DB immediately so frontend gets them before compaction/cleanup.
    // Same pattern as syncFilesNode — uses the codeFiles view (website_files + template_files).
    const generatedFiles = await db
      .select()
      .from(codeFiles)
      .where(eq(codeFiles.websiteId, state.websiteId!));

    const files = generatedFiles.reduce((acc, file) => {
      acc[file.path!] = { content: file.content!, created_at: file.createdAt!, modified_at: file.updatedAt! };
      return acc;
    }, {} as Website.FileMap);

    return {
      ...result,
      files,
      todos: result.todos ?? [],
    };
  }
);
