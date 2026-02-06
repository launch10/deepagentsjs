/**
 * Main coding agent prompt builder.
 * Composes shared prompt components into a complete system prompt.
 *
 * IMPORTANT: Prompt order is optimized for Anthropic prompt caching.
 * Static content comes FIRST (cacheable prefix), dynamic content comes LAST.
 * This allows ~90% of the prompt to be cached across all users/themes/modes.
 *
 * Cache-busting dynamic sections (at end):
 * - workflowPrompt: varies by Create/Edit/BugFix mode
 * - startByPrompt: varies by Create/Edit/BugFix mode
 * - typographyPrompt: varies by theme's typography recommendations
 */
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  userGoalPrompt,
  rolePrompt,
  contextPrompt,
  codingToolsPrompt,
  workflowPrompt,
  codeGuidelinesPrompt,
  trackingPrompt,
  themeColorsPrompt,
  environmentPrompt,
  typographyPrompt,
  animationsPrompt,
  startByPrompt,
  linksPrompt,
  imagesPrompt,
  fontAndResponsivePrompt,
  designPhilosophyPrompt,
  designChecklistPrompt,
  iconsPrompt,
  type CodingPromptState,
} from "./shared";

/**
 * Build the static context prompt (cacheable prefix).
 * Contains all the rich context about design, tools, tracking, etc.
 * Used by both the main coding agent and subagents.
 *
 * This is everything EXCEPT workflow-specific instructions (Create/Edit/BugFix mode).
 * The parent agent provides task-specific instructions when delegating to subagents.
 */
export const buildStaticContextPrompt = async (
  state: CodingPromptState,
  config?: LangGraphRunnableConfig
): Promise<string> => {
  const [
    userGoal,
    role,
    context,
    tools,
    links,
    icons,
    images,
    guidelines,
    tracking,
    themeColors,
    animations,
    fontAndResponsive,
    environment,
    designPhilosophy,
    designChecklist,
  ] = await Promise.all([
    userGoalPrompt(state, config),
    rolePrompt(state, config),
    contextPrompt(state, config),
    codingToolsPrompt(state, config),
    linksPrompt(state, config),
    iconsPrompt(state, config),
    imagesPrompt(state, config),
    codeGuidelinesPrompt(state, config),
    trackingPrompt(state, config),
    themeColorsPrompt(state, config),
    animationsPrompt(state, config),
    fontAndResponsivePrompt(state, config),
    environmentPrompt(state, config),
    designPhilosophyPrompt(state, config),
    designChecklistPrompt(state, config),
  ]);

  return `
${userGoal}

${role}

${context}

${tools}

${links}

${icons}

${images}

${guidelines}

${tracking}

## DESIGN GUIDANCE

${themeColors}

${animations}

${fontAndResponsive}

${environment}

${designPhilosophy}

${designChecklist}
`.trim();
};

/**
 * Build the complete coding agent system prompt.
 * All sub-prompts follow the async (state, config) pattern for consistency.
 */
export const buildCodingPrompt = async (
  state: CodingPromptState,
  config?: LangGraphRunnableConfig
): Promise<string> => {
  // Build static context (shared with subagents)
  const staticPrefix = await buildStaticContextPrompt(state, config);

  // Build dynamic sections (workflow-specific)
  const [workflow, startBy, typography] = await Promise.all([
    workflowPrompt(state, config),
    startByPrompt(state, config),
    typographyPrompt(state, config),
  ]);

  // ==========================================================================
  // DYNAMIC SUFFIX - Varies per request (workflow mode + theme typography)
  // ==========================================================================
  const dynamicSuffix = `
## EXECUTION MODE

${workflow}

${startBy}

## THEME-SPECIFIC TYPOGRAPHY

${typography}
`.trim();

  return `${staticPrefix}

${dynamicSuffix}`;
};
