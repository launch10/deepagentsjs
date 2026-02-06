import { db, websites, eq } from "@db";
import { Website } from "@types";
import { createDeepAgent, createSettings } from "deepagents";
import { getLLM, getLLMFallbacks, createPromptCachingMiddleware, createToolErrorSurfacingMiddleware, getLogger } from "@core";
import { WebsiteFilesBackend } from "@services";
import { SearchIconsTool } from "@tools";
import { buildCoderSubAgent } from "./subagents";
import { checkpointer } from "@core";
import {
  modelFallbackMiddleware as modelFallbackMiddlewareBuilder,
  type AgentMiddleware,
} from "langchain";
import { buildCodingPrompt, type CodingPromptState } from "@prompts";
import { ThemeAPIService } from "@rails_api";
import { singleShotEdit, classifyEditWithLLM } from "./singleShotEdit";
import { buildFileTree } from "./fileContext";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { toStructuredMessage } from "langgraph-ai-sdk";

export type MinimalCodingAgentState = {
  websiteId?: number;
  jwt?: string;
  theme?: CodingPromptState["theme"];
  errors?: string;
  isFirstMessage?: boolean;
};

export type EditRoute = "auto" | "single-shot" | "full";

export type CodingAgentOptions = {
  messages: BaseMessage[];
  systemPrompt?: string;
  existingBackend?: WebsiteFilesBackend;
  config?: LangGraphRunnableConfig;
  recursionLimit?: number;
  route?: EditRoute;
};

const getMiddlewares = (): AgentMiddleware[] => {
  // deepagents' createDeepAgent() includes summarizationMiddleware internally
  // (trigger: 170K tokens, keep: 6 messages). Upstream compaction in the
  // website graph's compactConversation node handles conversation-level summarization.
  // toolErrorSurfacing MUST be first — it wraps the outermost layer of the
  // wrapToolCall chain so that tool errors are returned as ToolMessages instead
  // of crashing the agent as MiddlewareErrors.
  return [createToolErrorSurfacingMiddleware(), createPromptCachingMiddleware()];
};

export const getCodingAgentBackend = async (state: MinimalCodingAgentState) => {
  if (!state.websiteId || !state.jwt) {
    throw new Error("websiteId and jwt are required");
  }

  const [websiteRow] = await db
    .select()
    .from(websites)
    .where(eq(websites.id, state.websiteId))
    .limit(1);

  if (!websiteRow) {
    throw new Error(`Website ${state.websiteId} not found`);
  }

  const website = websiteRow;

  // Move to using, so it will auto-cleanup, and add the async cleanup functions!
  const backend = await WebsiteFilesBackend.create({
    website,
    jwt: state.jwt,
  });

  return backend;
};

export const getTheme = async (
  state: MinimalCodingAgentState
): Promise<CodingPromptState["theme"] | undefined> => {
  if (!state.websiteId || !state.jwt) {
    return undefined;
  }

  const [websiteRow] = await db
    .select({ themeId: websites.themeId })
    .from(websites)
    .where(eq(websites.id, state.websiteId!))
    .limit(1);

  if (websiteRow?.themeId) {
    const themeAPI = new ThemeAPIService({ jwt: state.jwt });
    const theme = await themeAPI.get(websiteRow.themeId);

    return {
      id: theme.id,
      name: theme.name,
      colors: theme.colors,
      semanticVariables: theme.theme, // CSS custom properties (HSL values)
      typography_recommendations: theme.typography_recommendations,
    };
  }

  return undefined;
};

/**
 * Internal: build the full multi-turn coding agent with subagents + search icons.
 * This is the heavyweight path — Sonnet model, ~$0.10-0.50 per invocation.
 */
async function buildFullCodingAgent(
  state: MinimalCodingAgentState,
  systemPrompt?: string,
  existingBackend?: WebsiteFilesBackend
) {
  if (state.isFirstMessage === undefined) {
    throw new Error(
      "isFirstMessage is required - explicitly set to true (create) or false (edit/bugfix)"
    );
  }

  const backend = existingBackend ?? (await getCodingAgentBackend(state));
  const llm = (await getLLM({ skill: "coding", speed: "slow", cost: "paid" })).withConfig({ tags: ["notify"] });
  const middlewares = getMiddlewares();

  // Build prompt state for async prompt generation
  const promptState: CodingPromptState = {
    websiteId: state.websiteId,
    jwt: state.jwt,
    theme: state.theme,
    errors: state.errors,
    isFirstMessage: state.isFirstMessage,
  };

  // If no theme in state but we have websiteId, fetch theme from website
  if (!promptState.theme && state.websiteId) {
    promptState.theme = await getTheme(state);
  }

  // Build prompt and subagents - now async
  const [finalSystemPrompt, coderSubAgent] = await Promise.all([
    systemPrompt ? Promise.resolve(systemPrompt) : buildCodingPrompt(promptState),
    buildCoderSubAgent(promptState),
  ]);
  return createDeepAgent({
    model: llm as any,
    name: "coding-agent",
    systemPrompt: finalSystemPrompt,
    backend: () => backend as any,
    subagents: [coderSubAgent],
    tools: [new SearchIconsTool()],
    middleware: middlewares as any,
  });
}

/**
 * Determine the edit route when route is "auto".
 *
 * - First message (create flow) → full (needs exploration + subagents)
 * - Errors present → full (debugging needs tool loops)
 * - Custom systemPrompt → full (single-shot has its own prompt)
 * - Otherwise → classifier decides "simple" → single-shot, "complex" → full
 *
 * Returns the resolved route and, when single-shot is chosen, the backend
 * (to avoid recreating it in singleShotEdit).
 */
async function resolveRoute(
  state: MinimalCodingAgentState,
  options: CodingAgentOptions
): Promise<{ route: "single-shot" | "full"; backend?: WebsiteFilesBackend }> {
  // Create flow or bugfix → full agent, no question
  if (state.isFirstMessage) {
    return { route: "full" };
  }

  if (state.errors) {
    return { route: "full" };
  }

  // Custom system prompt means the caller has specialized behavior (SEO, bugfix, etc.)
  // that doesn't fit single-shot's own prompt
  if (options.systemPrompt) {
    return { route: "full" };
  }

  // Classify with cheap LLM
  const lastMessage = options.messages.at(-1);
  const userText = typeof lastMessage?.content === "string" ? lastMessage.content : "";

  const backend = options.existingBackend ?? (await getCodingAgentBackend(state));
  const { tree } = await buildFileTree(backend);

  const classification = await classifyEditWithLLM(userText, tree);
  getLogger().info({ route: classification }, "Edit classified");

  if (classification === "simple") {
    return { route: "single-shot", backend };
  }
  return { route: "full" };
}

/**
 * Unified entry point for all website code edits.
 *
 * Routes to the appropriate execution strategy:
 * - "single-shot": Pre-loads all files, one Haiku call with native text_editor (~$0.005)
 * - "full": Multi-turn Sonnet agent with subagents + search icons (~$0.10-0.50)
 * - "auto" (default): Cheap classifier decides between single-shot and full
 *
 * All callers get intelligent dispatch for free — no need to wire up routing externally.
 */
export async function createCodingAgent(
  state: MinimalCodingAgentState,
  options: CodingAgentOptions
): Promise<{ messages: BaseMessage[]; status: "completed" }> {
  if (state.isFirstMessage === undefined) {
    throw new Error(
      "isFirstMessage is required - explicitly set to true (create) or false (edit/bugfix)"
    );
  }

  const requestedRoute = options.route ?? "auto";

  // Resolve route
  let resolvedRoute: "single-shot" | "full";
  let escalated = false;
  let backend: WebsiteFilesBackend | undefined = options.existingBackend;

  if (requestedRoute === "auto") {
    const result = await resolveRoute(state, options);
    resolvedRoute = result.route;
    if (result.backend) backend = result.backend;
  } else {
    resolvedRoute = requestedRoute;
  }

  // Dispatch: single-shot path
  if (resolvedRoute === "single-shot") {
    getLogger().info("Using single-shot edit path");
    const result = await singleShotEdit(state, options.messages, backend);

    if (!result.allFailed) {
      return { messages: result.messages, status: "completed" };
    }

    // Total failure after retry — escalate to full agent
    getLogger().warn("Single-shot failed after retry, escalating to full agent");
    escalated = true;
    resolvedRoute = "full";
  }

  // Dispatch: full agent path
  getLogger().info("Using full agent path");
  const agent = await buildFullCodingAgent(state, options.systemPrompt, backend);

  const result = await agent.invoke(
    { messages: options.messages },
    {
      ...options.config,
      recursionLimit: options.recursionLimit ?? 150,
    }
  );

  // Extract the first and last AI messages for the caller.
  // The first AI message is the personalized greeting (create flow) or initial response,
  // and the last is the final summary. Persisting both preserves the conversational feel on reload.
  const aiMessages = result.messages.filter(
    (msg: BaseMessage) => msg._getType() === "ai"
  );
  const firstAI = aiMessages.at(0);
  const lastAI = aiMessages.at(-1);

  // Deduplicate if only one AI message (first === last)
  const userFacing: BaseMessage[] = firstAI && lastAI && firstAI !== lastAI
    ? [firstAI, lastAI]
    : [firstAI ?? lastAI].filter((m): m is BaseMessage => !!m);

  const structuredMessages = (
    await Promise.all(userFacing.map((msg) => toStructuredMessage(msg)))
  ).map(([m]) => m).filter(Boolean);

  // When escalating from single-shot, prepend a brief note so the user
  // understands why the response took longer than a typical quick edit.
  if (escalated) {
    const escalationMsg = new AIMessage({
      content: "This change needs a bit more work — taking a closer look...",
    });
    const [structured] = await toStructuredMessage(escalationMsg);
    structuredMessages.unshift(structured);
  }

  return {
    messages: structuredMessages as BaseMessage[],
    status: "completed" as const,
  };
}
