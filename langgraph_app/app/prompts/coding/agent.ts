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
  designChecklistPrompt,
  iconsPrompt,
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
    // STATIC sections (cacheable prefix)
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
    designChecklist,
    // DYNAMIC sections (cache-busting, must be at end)
    workflow,
    startBy,
    typography,
  ] = await Promise.all([
    // STATIC sections (cacheable prefix)
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
    designChecklistPrompt(state, config),
    // DYNAMIC sections (cache-busting, must be at end)
    workflowPrompt(state, config),
    startByPrompt(state, config),
    typographyPrompt(state, config),
  ]);

  // ==========================================================================
  // STATIC PREFIX - Cacheable across ALL users, themes, and modes
  // ==========================================================================
  const staticPrefix = `
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

${designChecklist}
`.trim();

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
