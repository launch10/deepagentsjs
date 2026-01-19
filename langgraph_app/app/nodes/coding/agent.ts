import { db, websites, eq } from "@db";
import { Website } from "@types";
import { createDeepAgent, createSkillsMiddleware, createSettings } from "deepagents";
import { getLLM, getLLMFallbacks } from "@core";
import { WebsiteFilesBackend } from "@services";
import { SearchIconsTool } from "@tools";
import { copywriterSubAgent, buildCoderSubAgent } from "./subagents";
import { checkpointer } from "@core";
import {
  toolRetryMiddleware,
  modelFallbackMiddleware as modelFallbackMiddlewareBuilder,
  summarizationMiddleware as summarizationMiddlewareBuilder,
  type AgentMiddleware,
} from "langchain";
import { buildCodingPrompt, type CodingPromptState } from "@prompts";
import { ThemeAPIService } from "@rails_api";
import path from "path";

export type MinimalCodingAgentState = {
  websiteId?: number;
  jwt?: string;
  theme?: CodingPromptState["theme"];
  errors?: string;
  isFirstMessage?: boolean;
};

// Skills directory for design-focused agent skills
const SKILLS_DIR = path.join(process.cwd(), ".deepagents/skills");

const getMiddlewares = (): AgentMiddleware[] => {
  // const fallbacks = getLLMFallbacks("coding", "slow", "paid");
  // const modelFallbackMiddleware = modelFallbackMiddlewareBuilder(...fallbacks);
  // TODO: We get error: SummarizationMiddleware is defined multiple times... is it defined inside deepagents lib?
  // const summarizationMiddleware = summarizationMiddlewareBuilder({
  //   model: getLLM("reasoning", "fast", "paid"),
  //   trigger: { fraction: 0.7 },
  //   keep: { messages: 15 },
  // });

  // Skills middleware for design-focused skills
  const skillsMiddleware = createSkillsMiddleware({
    skillsDir: SKILLS_DIR,
    assistantId: "coding-agent",
  });

  return [toolRetryMiddleware(), skillsMiddleware];
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

const getTheme = async (
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

    console.log(theme);
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

export async function createCodingAgent(
  state: MinimalCodingAgentState,
  systemPrompt?: string,
  existingBackend?: WebsiteFilesBackend
) {
  if (state.isFirstMessage === undefined) {
    throw new Error(
      "isFirstMessage is required - explicitly set to true (create) or false (edit/bugfix)"
    );
  }

  const backend = existingBackend ?? await getCodingAgentBackend(state);
  const llm = await getLLM({ skill: "coding", speed: "slow", cost: "paid" });
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
  console.log(finalSystemPrompt);

  return createDeepAgent({
    model: llm as any,
    name: "coding-agent",
    systemPrompt: finalSystemPrompt,
    backend: () => backend as any,
    subagents: [copywriterSubAgent, coderSubAgent],
    tools: [new SearchIconsTool()],
    middleware: middlewares as any,
    checkpointer: checkpointer as any,
  });
}
