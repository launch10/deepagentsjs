import type { SubAgent } from "deepagents";
import type { CodingPromptState } from "@prompts";
import { buildStaticContextPrompt } from "@prompts";

/**
 * Build the coder subagent with dynamic context from the parent agent's state.
 * Uses the same rich context (design, tools, tracking, etc.) as the main coding agent,
 * but without workflow-specific instructions (the parent agent provides those).
 */
export const buildCoderSubAgent = async (state: CodingPromptState): Promise<SubAgent> => {
  const systemPrompt = await buildStaticContextPrompt(state);

  return {
    name: "coder",
    description:
      "Expert React/TypeScript developer for implementing landing page components. Use this agent to create or modify specific components with provided copy and specifications. Provide: the component name, file path, the copy/content to use, and any specific requirements.",
    systemPrompt,
  };
};
