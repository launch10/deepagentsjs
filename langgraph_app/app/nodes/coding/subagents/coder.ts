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
  const staticPrompt = await buildStaticContextPrompt(state);

  const coderInstructions = `
## Coder Subagent Instructions

You are implementing one section of a larger landing page. Your task includes a DESIGN BRIEF — follow it precisely. Every section must feel like it belongs to the same page, built by the same designer.

### How to Work
1. **Read first**: ALWAYS read the existing file with read_file before writing. See what's already there (template structure, styles, imports).
2. **Edit when possible**: If a template file exists for your component, prefer edit_file over write_file. Build on the existing structure rather than replacing it wholesale.
3. **Follow the brief**: Your task includes a Design Brief with the aesthetic direction, font choices, and color strategy. Match these EXACTLY — do not freelance a different aesthetic.
4. **Match the rhythm**: Your task specifies this section's background role (bg-primary, bg-muted, bg-background). Use it. The rhythm across sections creates the page's visual flow.
`;

  return {
    name: "coder",
    description:
      "Expert React/TypeScript developer for implementing landing page sections. Each task includes a Design Brief (aesthetic direction, fonts, colors, rhythm) and section-specific specs. The coder reads existing files first, then builds or edits to match the brief precisely.",
    systemPrompt: staticPrompt + "\n\n" + coderInstructions,
    middleware: [createToolErrorSurfacingMiddleware(), createPromptCachingMiddleware()],
    ...(model ? { model } : {}),
  };
};
