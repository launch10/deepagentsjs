import type { SubAgent } from "deepagents";
import type { CodingPromptState } from "@prompts";
import { buildStaticContextPrompt } from "@prompts";
import { createPromptCachingMiddleware, createToolErrorSurfacingMiddleware } from "@core";
import type { LanguageModelLike } from "@langchain/core/language_models/base";

/**
 * Build the coder subagent with dynamic context from the parent agent's state.
 * Uses the same rich context (design, tools, tracking, etc.) as the main coding agent,
 * but without workflow-specific instructions (the parent agent provides those).
 *
 * @param model - Optional LLM override. When provided, the subagent uses this model
 *   instead of inheriting the parent's. Used to give the subagent an LLM without
 *   the "notify" tag so its tokens don't stream to the frontend.
 */
export const buildCoderSubAgent = async (
  state: CodingPromptState,
  model?: LanguageModelLike
): Promise<SubAgent> => {
  const systemPrompt = await buildStaticContextPrompt(state);

  return {
    name: "coder",
    description:
      "Expert React/TypeScript developer for implementing landing page components. Use this agent to create or modify specific components with provided copy and specifications. Provide: the component name, file path, the copy/content to use, and any specific requirements.",
    systemPrompt,
    middleware: [createToolErrorSurfacingMiddleware(), createPromptCachingMiddleware()],
    ...(model ? { model } : {}),
  };
};
