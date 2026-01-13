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
  designDirectionPrompt,
  componentDesignPrompt,
  animationsPrompt,
  visualEffectsPrompt,
  spacingScalePrompt,
  heroVariationsPrompt,
  colorHarmonyPrompt,
  antiPatternsPrompt,
  sectionRecipesPrompt,
  fontAndResponsivePrompt,
  surfaceHarmonyPrompt,
  imageStrategyPrompt,
  designChecklistPrompt,
  gradientRecipesPrompt,
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
    designDirection,
    componentDesign,
    animations,
    visualEffects,
    spacingScale,
    heroVariations,
    colorHarmony,
    antiPatterns,
    sectionRecipes,
    fontAndResponsive,
    surfaceHarmony,
    imageStrategy,
    designChecklist,
    gradientRecipes,
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
    designDirectionPrompt(state, config),
    componentDesignPrompt(state, config),
    animationsPrompt(state, config),
    visualEffectsPrompt(state, config),
    spacingScalePrompt(state, config),
    heroVariationsPrompt(state, config),
    colorHarmonyPrompt(state, config),
    antiPatternsPrompt(state, config),
    sectionRecipesPrompt(state, config),
    fontAndResponsivePrompt(state, config),
    surfaceHarmonyPrompt(state, config),
    imageStrategyPrompt(state, config),
    designChecklistPrompt(state, config),
    gradientRecipesPrompt(state, config),
  ]);

//   return `
// ${userGoal}

// ${role}

// ${workflow}

// ${context}

// ${tools}

// ${links}

// ${images}

// ${guidelines}

// ${tracking}

// ## DESIGN GUIDANCE

// ${designDirection}

// ${antiPatterns}

// ${themeColors}

// ${colorHarmony}

// ${surfaceHarmony}

// ${typography}

// ${fontAndResponsive}

// ## DESIGN PATTERNS

// ${componentDesign}

// ${heroVariations}

// ${sectionRecipes}

// ${animations}

// ${visualEffects}

// ${gradientRecipes}

// ${spacingScale}

// ${imageStrategy}

// ## EXECUTION

// ${environment}

// ${startBy}

// ${designChecklist}
// `;
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

## DESIGN GUIDANCE

${themeColors}

${typography}

${fontAndResponsive}

## EXECUTION

${environment}

${startBy}

${designChecklist}
`;
};
