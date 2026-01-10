/**
 * Main coding agent prompt builder.
 * Composes shared prompt components into a complete system prompt.
 */
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  contextPrompt,
  codingToolsPrompt,
  workflowPrompt,
  codeGuidelinesPrompt,
  trackingContextPrompt,
  fileStructurePrompt,
  themeColorsPrompt,
  environmentPrompt,
  typographyPrompt,
  type CodingPromptState,
} from "./shared";

/**
 * Build the complete coding agent system prompt.
 * All sub-prompts follow the async (state, config) pattern for consistency.
 */
export const buildCodingPrompt = async (
  state: CodingPromptState,
  config?: LangGraphRunnableConfig
): Promise<string> => {
  // Fetch all prompt sections in parallel
  const [
    context,
    tools,
    workflow,
    guidelines,
    tracking,
    fileStructure,
    themeColors,
    environment,
    typography,
  ] = await Promise.all([
    contextPrompt(state, config),
    codingToolsPrompt(state, config),
    workflowPrompt(state, config),
    codeGuidelinesPrompt(state, config),
    trackingContextPrompt(state, config),
    fileStructurePrompt(state, config),
    themeColorsPrompt(state, config),
    environmentPrompt(state, config),
    typographyPrompt(state, config),
  ]);

  return `You are an expert landing page developer. You create high-converting landing pages that drive pre-sales signups.

${context}

${tools}

${workflow}

${guidelines}

${tracking}

${fileStructure}

${themeColors}

${typography}

${environment}

Start by exploring the existing template structure with ls and glob, then create the landing page sections.`;
};
