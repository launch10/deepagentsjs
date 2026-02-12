import type { WebsiteGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { toStructuredMessage, createContextMessage } from "langgraph-ai-sdk";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "@nodes";
import { isCacheModeEnabled } from "./cacheMode";
import { getSchedulingToolMinorEditFiles } from "@cache";
import type { Website } from "@types";
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

/** Build extra context messages for this turn (create instructions, build errors). */
function buildExtraContext(state: WebsiteGraphState, isCreate: boolean): BaseMessage[] {
  const extraContext: BaseMessage[] = [];

  if (isCreate) {
    extraContext.push(
      createContextMessage("Create a landing page for this business", { timestamp: new Date().toISOString() })
    );
  }

  if (state.consoleErrors?.length) {
    const errors = state.consoleErrors.filter((e) => e.type === "error");
    if (errors.length > 0) {
      const errorSummary = errors
        .map((e) => `- ${e.message}${e.file ? ` (${e.file})` : ""}`)
        .join("\n");
      extraContext.push(
        createContextMessage(`[Build Errors — fix these]\n${errorSummary}`, { timestamp: new Date().toISOString() })
      );
    }
  }

  return extraContext;
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

    // In cache mode (create only), return cached files instead of running the agent
    const cacheEnabled = isCacheModeEnabled(state);
    const isCreate = await isCreateFlow(state);

    if (cacheEnabled) {
      getLogger().info("Cache mode enabled, returning cached files");
      return await cachedResponse(state);
    }

    const result = await createCodingAgent(
      { ...state, isCreateFlow: isCreate },
      {
        messages: state.messages || [],
        extraContext: buildExtraContext(state, isCreate),
        graphName: "website",
        maxTurnPairs: isCreate ? Infinity : 10,
        maxChars: isCreate ? Infinity : 40_000,
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
    // Guard: only return files if the agent actually wrote to website_files.
    // The codeFiles view includes template fallbacks — without this guard,
    // template "Hello world" content leaks into state before the agent writes real files.
    const agentWroteFiles = await db
      .select()
      .from(websiteFiles)
      .where(eq(websiteFiles.websiteId!, state.websiteId!))
      .limit(1);

    if (agentWroteFiles.length > 0) {
      // Agent wrote files — return full set (agent files + template fallbacks via codeFiles view)
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
        consoleErrors: [],
      };
    }

    // Agent didn't write files — don't return template files here.
    // syncWebsiteChangesNode at the end of the graph will handle it.
    return {
      ...result,
      todos: result.todos ?? [],
      consoleErrors: [],
    };
  }
);
