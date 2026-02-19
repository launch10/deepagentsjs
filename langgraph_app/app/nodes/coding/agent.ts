import { db, websites, eq } from "@db";
import { Website } from "@types";
import { createDeepAgent, createSettings } from "deepagents";
import {
  getLLM,
  getLLMFallbacks,
  createPromptCachingMiddleware,
  createToolErrorSurfacingMiddleware,
  getLogger,
  sentry,
} from "@core";
import { WebsiteFilesBackend } from "@services";
import { SearchIconsTool, changeColorSchemeTool } from "@tools";
import { buildCoderSubAgent } from "./subagents";
import { checkpointer } from "@core";
import {
  createMiddleware,
  modelFallbackMiddleware as modelFallbackMiddlewareBuilder,
  type AgentMiddleware,
} from "langchain";
import { buildCodingPrompt, type CodingPromptState } from "@prompts";
import { ThemeAPIService } from "@rails_api";
import { singleShotEdit, classifyEditWithLLM } from "./singleShotEdit";
import { buildFileTree } from "./fileContext";
import { sanitizeMessagesForLLM } from "./messageUtils";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { toStructuredMessages } from "langgraph-ai-sdk";
import { prepareTurn, Conversation } from "@conversation";
import type { SubscribableGraph } from "@conversation";

export type MinimalCodingAgentState = {
  websiteId?: number;
  projectId?: number;
  jwt?: string;
  theme?: CodingPromptState["theme"];
  errors?: string;
  consoleErrors?: Website.Errors.ConsoleError[];
  isCreateFlow?: boolean;
};

export type EditRoute = "auto" | "single-shot" | "full";

export type CodingAgentOptions = {
  messages: BaseMessage[];
  systemPrompt?: string;
  existingBackend?: WebsiteFilesBackend;
  config?: LangGraphRunnableConfig;
  recursionLimit?: number;
  route?: EditRoute;
  /** Extra context messages to inject (build errors, copy instructions, etc.) */
  extraContext?: BaseMessage[];
  /** Graph name for event subscriptions. When set, fetches Rails events. */
  graphName?: SubscribableGraph;
  /** Max turn pairs to keep in context window. Default: 10 */
  maxTurnPairs?: number;
  /** Max total chars in context window. Default: 40000 */
  maxChars?: number;
  /** Override subagents passed to createDeepAgent. Pass [] to disable subagents. */
  subagents?: any[];
};

/**
 * Custom middleware that enforces todo usage for ALL agent work.
 *
 * deepagents' todoListMiddleware() is hardcoded with no options and its built-in
 * prompt tells the agent to skip todos for "simple" tasks (<3 steps). But our
 * users are non-technical and need visibility into what the agent is doing at
 * all times. Custom middleware added via the `middleware` param runs after
 * built-ins, so this appends *after* the todoListMiddleware's own system
 * prompt, giving it "last word" advantage.
 */
const todoOverrideMiddleware = createMiddleware({
  name: "todoOverride",
  wrapModelCall: (request, handler) =>
    handler({
      ...request,
      systemMessage: request.systemMessage.concat(
        `\n\nEVERY RESPONSE MUST FOLLOW THIS PATTERN — NO EXCEPTIONS:\n\n` +
          `1. MESSAGE FIRST: Always begin your response with a brief, friendly message ` +
          `to the user (1-2 sentences) describing what you're about to do, BEFORE ` +
          `calling any tools. This gives the user immediate feedback that their request is being ` +
          `handled. For example: "I'll update the copy across all sections to be more professional ` +
          `and compelling."\n\n` +
          `2. TODOS ALWAYS: ALWAYS call write_todos to create a todo list — even for simple edits. ` +
          `The user is non-technical and needs to see what's happening. Create todos BEFORE doing ` +
          `any work. Keep them high-level and clear (no file names or code jargon). ` +
          `For simple edits: at least 1-2 todos (e.g. "Update the headline copy", "Polish the CTA"). ` +
          `For multi-file work: one todo per section or file being changed. ` +
          `For subagent delegation: one todo per subagent dispatch. ` +
          `Mark todos as in_progress when you start them and completed when done.\n\n` +
          `3. DELEGATE OR DO: Either delegate todos to subagents via the task tool, or complete ` +
          `them yourself. When dispatching subagents, launch ALL in ONE message (parallel). ` +
          `ALWAYS pass the todo_id parameter when dispatching subagents so progress updates in ` +
          `real time. Example:\n` +
          `task(description="Build the hero section...", subagent_type="coder", todo_id="<uuid>")\n\n` +
          `NEVER skip todos. NEVER skip the introductory message. The user must always see ` +
          `what you're doing and track progress.`
      ),
    }),
});

const getMiddlewares = (): AgentMiddleware[] => {
  // deepagents' createDeepAgent() includes summarizationMiddleware internally
  // (trigger: 170K tokens, keep: 6 messages). Upstream compaction in the
  // website graph's compactConversation node handles conversation-level summarization.
  // toolErrorSurfacing MUST be first — it wraps the outermost layer of the
  // wrapToolCall chain so that tool errors are returned as ToolMessages instead
  // of crashing the agent as MiddlewareErrors.
  return [
    createToolErrorSurfacingMiddleware(),
    createPromptCachingMiddleware(),
    todoOverrideMiddleware,
  ];
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
    try {
      const themeAPI = new ThemeAPIService({ jwt: state.jwt });
      const theme = await themeAPI.get(websiteRow.themeId);
      return {
        id: theme.id,
        name: theme.name,
        colors: theme.colors,
        semanticVariables: theme.theme, // CSS custom properties (HSL values)
        typography_recommendations: theme.typography_recommendations,
      };
    } catch (error) {
      getLogger().error(`Failed to fetch theme ${JSON.stringify(error)}`);
      return undefined;
    }
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
  existingBackend?: WebsiteFilesBackend,
  overrideSubagents?: any[]
) {
  if (state.isCreateFlow === undefined) {
    throw new Error(
      "isCreateFlow is required - explicitly set to true (create) or false (edit/bugfix)"
    );
  }

  const backend = existingBackend ?? (await getCodingAgentBackend(state));
  const baseLlm = await getLLM({ skill: "coding", speed: "slow", cost: "paid" });
  const notifyLlm = baseLlm.withConfig({ tags: ["notify"] });
  const middlewares = getMiddlewares();

  // Build prompt state for async prompt generation
  const promptState: CodingPromptState = {
    websiteId: state.websiteId,
    jwt: state.jwt,
    theme: state.theme,
    errors: state.errors,
    isCreateFlow: state.isCreateFlow,
  };

  // If no theme in state but we have websiteId, fetch theme from website
  if (!promptState.theme && state.websiteId) {
    promptState.theme = await getTheme(state);
  }

  // Build prompt and subagents - now async
  // Skip subagent creation when caller overrides (e.g. bugfix with subagents: [])
  const hasSubagentOverride = overrideSubagents !== undefined;
  const [finalSystemPrompt, coderSubAgent] = await Promise.all([
    systemPrompt ? Promise.resolve(systemPrompt) : buildCodingPrompt(promptState),
    hasSubagentOverride ? Promise.resolve(null) : buildCoderSubAgent(promptState, baseLlm),
  ]);
  const subagents = hasSubagentOverride ? overrideSubagents : [coderSubAgent];
  const agent = createDeepAgent({
    model: notifyLlm as any,
    name: "coding-agent",
    systemPrompt: finalSystemPrompt,
    backend: () => backend as any,
    subagents,
    tools: [
      new SearchIconsTool(),
      changeColorSchemeTool,
    ],
    middleware: middlewares as any,
  });
  return { agent, backend };
}

/**
 * Determine the edit route (singleShotEdit or full agent)
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
  if (state.isCreateFlow) {
    return { route: "full" };
  }

  if (state.errors) {
    return { route: "full" };
  }

  // Build errors from WebContainer → instant escalation, no classifier needed
  if (state.consoleErrors && state.consoleErrors.some((e) => e.type === "error")) {
    getLogger().info("Build errors detected, routing to full agent");
    return { route: "full" };
  }

  // Custom system prompt means the caller has specialized behavior (SEO, bugfix, etc.)
  // that doesn't fit single-shot's own prompt
  if (options.systemPrompt) {
    return { route: "full" };
  }

  // Image context in the CURRENT turn → full agent.
  // Image swaps touch multiple files (HTML references, imports), so single-shot won't cut it.
  // Only checks the last turn — not the entire history (old images don't affect new edits).
  const conversation = new Conversation(options.messages);
  if (conversation.currentTurn()?.hasImageContext()) {
    getLogger().info("Image context detected in current turn, routing to full agent");
    return { route: "full" };
  }

  // Classify with cheap LLM — include recent conversational history so the
  // classifier understands ambiguous messages like "great and 3 bloods I guess"
  const lastMessage = options.messages.at(-1);
  const userText = typeof lastMessage?.content === "string" ? lastMessage.content : "";
  const recentHistory = conversation.digestMessages(4);

  const backend = options.existingBackend ?? (await getCodingAgentBackend(state));
  const { tree } = await buildFileTree(backend);

  const classification = await classifyEditWithLLM(userText, tree, recentHistory);
  getLogger().info({ route: classification }, "Edit classified");

  if (classification === "simple") {
    return { route: "single-shot", backend };
  }
  return { route: "full" };
}

/**
 * Prepare conversation for the LLM.
 *
 * When graphName + projectId + jwt are present, fetches Rails events
 * (brainstorm, images, etc.) and injects them as context. Always
 * injects any extraContext and windows to fit within limits.
 *
 * No-ops gracefully for single-turn callers that pass fresh messages.
 */
async function prepareConversation(
  state: MinimalCodingAgentState,
  options: CodingAgentOptions
): Promise<BaseMessage[]> {
  // Full preparation: fetch events from Rails + inject context + window
  if (options.graphName && state.projectId && state.jwt) {
    return prepareTurn({
      graphName: options.graphName,
      projectId: state.projectId,
      jwt: state.jwt,
      messages: options.messages,
      extraContext: options.extraContext,
      maxTurnPairs: options.maxTurnPairs,
      maxChars: options.maxChars,
    });
  }

  // No event fetching, but still inject any extra context + window
  if (options.extraContext?.length) {
    return new Conversation(options.messages).prepareTurn({
      contextMessages: options.extraContext,
      maxTurnPairs: options.maxTurnPairs,
      maxChars: options.maxChars,
    });
  }

  // No preparation needed (single-turn, no context)
  return options.messages;
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
): Promise<{
  messages: BaseMessage[];
  status: "completed";
  todos?: Array<{ id: string; content: string; status: "pending" | "in_progress" | "completed" }>;
  files?: Website.FileMap;
}> {
  if (state.isCreateFlow === undefined) {
    throw new Error(
      "isCreateFlow is required - explicitly set to true (create) or false (edit/bugfix)"
    );
  }

  try {
    return await _createCodingAgentInternal(state, options);
  } catch (error) {
    // Maximum durability: never let an unhandled error leave the user with no response.
    // Log + report the error, then return a user-friendly message.
    getLogger().error({ err: error }, "createCodingAgent crashed — returning fallback message");
    sentry.error(error instanceof Error ? error : new Error(String(error)), {
      context: "createCodingAgent",
      websiteId: state.websiteId,
      isCreateFlow: state.isCreateFlow,
      route: options.route ?? "auto",
    });

    return {
      messages: await toStructuredMessages([
        new AIMessage({
          content:
            "I ran into an issue processing your request. Could you try again? If the problem persists, try rephrasing your request.",
        }),
      ]),
      status: "completed",
    };
  }
}

/** Internal implementation — wrapped by createCodingAgent's durability catch. */
async function _createCodingAgentInternal(
  state: MinimalCodingAgentState,
  options: CodingAgentOptions
): Promise<{
  messages: BaseMessage[];
  status: "completed";
  todos?: Array<{ id: string; content: string; status: "pending" | "in_progress" | "completed" }>;
  files?: Website.FileMap;
}> {
  const requestedRoute = options.route ?? "auto";

  // Prepare conversation: fetch events, inject context, window.
  // Full preparation when graphName + projectId + jwt are present.
  // Falls back to pure windowing + context injection when only extraContext is provided.
  // No-ops for single-turn callers (bugFix, SEO) that pass fresh messages.
  const preparedMessages = await prepareConversation(state, options);

  // Sanitize messages — strips orphaned tool_use (AIMessages with tool_calls
  // not followed by ToolMessages) and orphaned tool_result (ToolMessages whose AIMessage
  // was removed by compactConversation). Both cause Claude API errors.
  const sanitizedMessages = sanitizeMessagesForLLM(preparedMessages);

  // Resolve route
  let resolvedRoute: "single-shot" | "full";
  let escalated = false;
  let backend: WebsiteFilesBackend | undefined = options.existingBackend;

  if (requestedRoute === "auto") {
    const result = await resolveRoute(state, options);
    resolvedRoute = result.route;
    if (result.backend) backend = result.backend;
    getLogger().info(
      { resolvedRoute, userMessage: truncate(lastMessageText(options.messages)) },
      "Route resolved"
    );
  } else {
    resolvedRoute = requestedRoute;
  }

  // Dispatch: single-shot path
  if (resolvedRoute === "single-shot") {
    getLogger().info("Using single-shot edit path");
    const result = await singleShotEdit(state, sanitizedMessages, backend);

    if (!result.allFailed) {
      return {
        messages: await toStructuredMessages(result.messages),
        status: "completed",
        ...(result.files ? { files: result.files } : {}),
      };
    }

    // Total failure after retry — escalate to full agent
    getLogger().warn("Single-shot failed after retry, escalating to full agent");
    escalated = true;
    resolvedRoute = "full";
  }

  // Dispatch: full agent path
  getLogger().info("Using full agent path");
  const { agent, backend: agentBackend } = await buildFullCodingAgent(
    state,
    options.systemPrompt,
    backend,
    options.subagents
  );

  const result = (await agent.invoke(
    { messages: sanitizedMessages },
    { ...options.config, recursionLimit: options.recursionLimit ?? 150 }
  )) as { messages: BaseMessage[]; todos?: any[] };

  // Flush all deferred writes to DB in one batch
  await agentBackend.flush();

  // agent.invoke() returns [...inputMessages, ...newMessages].
  // Slice off the input messages to return only NEW messages from the agent.
  const allMessages = result.messages ?? [];
  const messages = allMessages.slice(sanitizedMessages.length);

  // When escalating from single-shot, prepend a brief note so the user
  // understands why the response took longer than a typical quick edit.
  if (escalated) {
    messages.unshift(
      new AIMessage({
        content: "This change needs a bit more work — taking a closer look...",
      })
    );
  }

  // deepagents' todoListMiddleware adds todos to the agent state, but the
  // MergedAgentState type doesn't reflect it. Access via index signature.
  const todos = (result as any).todos as
    | Array<{ id: string; content: string; status: "pending" | "in_progress" | "completed" }>
    | undefined;

  return {
    messages: await toStructuredMessages(messages),
    status: "completed" as const,
    todos,
  };
}

function lastMessageText(messages: BaseMessage[]): string {
  const last = messages.at(-1);
  return typeof last?.content === "string" ? last.content : "";
}

function truncate(text: string, maxLen = 100): string {
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}
