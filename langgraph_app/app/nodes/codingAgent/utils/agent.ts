import { db, websites, themes, eq } from "@db";
import { Website } from "@types";
import { createDeepAgent } from "deepagents";
import { getLLM, getLLMFallbacks } from "@core";
import { WebsiteFilesBackend } from "@services";
import { SearchIconsTool } from "@tools";
import { copywriterSubAgent, coderSubAgent } from "../subagents";
import { checkpointer } from "@core";
import {
  toolRetryMiddleware,
  modelFallbackMiddleware as modelFallbackMiddlewareBuilder,
  type AgentMiddleware,
} from "langchain";
import { buildCodingPrompt, type CodingPromptState } from "@prompts";

const getMiddlewares = (): AgentMiddleware[] => {
  const fallbacks = getLLMFallbacks("coding", "slow", "paid");
  const modelFallbackMiddleware = modelFallbackMiddlewareBuilder(...fallbacks);
  // const summarizationMiddleware = summarizationMiddlewareBuilder({
  //   model: getLLM("summarization", "fast", "paid"),
  //   trigger: { fraction: 0.7 },
  //   keep: { messages: 15 },
  // })
  return [toolRetryMiddleware(), modelFallbackMiddleware];
};

export type MinimalCodingAgentState = {
  websiteId?: number;
  jwt?: string;
  theme?: CodingPromptState["theme"];
  errors?: string;
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

  const website = websiteRow as Website.WebsiteType;

  // Move to using, so it will auto-cleanup, and add the async cleanup functions!
  const backend = await WebsiteFilesBackend.create({
    website,
    jwt: state.jwt,
  });

  return backend;
};

export async function createCodingAgent(state: MinimalCodingAgentState, prompt?: string) {
  const backend = await getCodingAgentBackend(state);
  const llm = getLLM("coding", "slow", "paid");
  const middlewares = getMiddlewares();

  // Build prompt state for async prompt generation
  const promptState: CodingPromptState = {
    websiteId: state.websiteId,
    jwt: state.jwt,
    theme: state.theme,
    errors: state.errors,
  };

  // If no theme in state but we have websiteId, fetch theme from website
  if (!promptState.theme && state.websiteId) {
    const [websiteRow] = await db
      .select({ themeId: websites.themeId })
      .from(websites)
      .where(eq(websites.id, state.websiteId))
      .limit(1);

    if (websiteRow?.themeId) {
      const [themeRow] = await db
        .select()
        .from(themes)
        .where(eq(themes.id, websiteRow.themeId))
        .limit(1);

      if (themeRow) {
        promptState.theme = {
          id: themeRow.id,
          name: themeRow.name,
          colors: themeRow.colors as string[] | undefined,
        };
      }
    }
  }

  // Build prompt - now async
  const systemPrompt = prompt || (await buildCodingPrompt(promptState));

  return createDeepAgent({
    model: llm as any,
    name: "coding-agent",
    systemPrompt,
    backend: () => backend as any,
    subagents: [copywriterSubAgent, coderSubAgent],
    tools: [new SearchIconsTool()],
    middleware: middlewares as any,
    checkpointer: checkpointer as any,
  });
}
