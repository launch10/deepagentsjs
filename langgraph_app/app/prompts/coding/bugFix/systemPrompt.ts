/**
 * Bug fix prompt builder for the coding agent.
 * Uses shared components plus error context from state.
 */
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { codeGuidelinesPrompt, type CodingPromptState, type CodingPromptFn } from "../shared";

/**
 * Build a system prompt for fixing runtime errors.
 * Errors are passed via state.errors for consistency with other prompts.
 */
export const buildBugFixPrompt: CodingPromptFn = async (
  state: CodingPromptState,
  config?: LangGraphRunnableConfig
): Promise<string> => {
  const guidelines = await codeGuidelinesPrompt(state, config);
  const errorContext = state.errors || "";

  return `You are fixing runtime errors in a landing page before deployment.

The site uses React Router, Tailwind, and ShadCN.

<errors>
${errorContext}
</errors>

<instructions>
Make the minimal viable change to fix these errors. Target the affected files directly and make the fix — do not explore the filesystem broadly or refactor unrelated code.
</instructions>

${guidelines}`;
};
