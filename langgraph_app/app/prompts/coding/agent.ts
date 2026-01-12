/**
 * Main coding agent prompt builder.
 * Composes shared prompt components into a complete system prompt.
 */
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  userGoalPrompt,
  rolePrompt,
  contextPrompt,
  codingToolsPrompt,
  workflowPrompt,
  codeGuidelinesPrompt,
  trackingContextPrompt,
  themeColorsPrompt,
  environmentPrompt,
  typographyPrompt,
  startByPrompt,
  linksPrompt,
  imagesPrompt,
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
    userGoal,
    role,
    context,
    tools,
    workflow,
    guidelines,
    tracking,
    themeColors,
    environment,
    typography,
    startBy,
    links,
    images,
  ] = await Promise.all([
    userGoalPrompt(state, config),
    rolePrompt(state, config),
    contextPrompt(state, config),
    codingToolsPrompt(state, config),
    workflowPrompt(state, config),
    codeGuidelinesPrompt(state, config),
    trackingContextPrompt(state, config),
    themeColorsPrompt(state, config),
    environmentPrompt(state, config),
    typographyPrompt(state, config),
    startByPrompt(state, config),
    linksPrompt(state, config),
    imagesPrompt(state, config),
  ]);

  return `
${userGoal}

${role}

${workflow}

${context}

${tools}

${links}

${images}

${guidelines}

${tracking}

${themeColors}

${typography}

${environment}

${workflow}

${startBy}
`;
};
