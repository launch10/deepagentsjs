/**
 * Shared prompt components for coding agents.
 * All prompts follow the async (state, config) pattern.
 */
export { trackingContextPrompt } from "./trackingContext";
export { codeGuidelinesPrompt } from "./codeGuidelines";
export { environmentPrompt } from "./environment";
export { fileStructurePrompt } from "./fileStructure";
export { themeColorsPrompt } from "./design/themeColors";
export { typographyPrompt, formatTypographyPrompt } from "./design/typography";
export { codingToolsPrompt } from "./tools";
export { workflowPrompt, startByPrompt } from "./workflow";
export { contextPrompt } from "./context";
export { userGoalPrompt } from "./goal";
export { rolePrompt } from "./role";
export { linksPrompt } from "./links";
export { imagesPrompt } from "./images";
export { designDirectionPrompt } from "./design/designDirection";
export { componentDesignPrompt } from "./design/componentDesign";
export { animationsPrompt } from "./patterns/animations";
export { visualEffectsPrompt } from "./patterns/visualEffects";
export { spacingScalePrompt } from "./patterns/spacingScale";
export { heroVariationsPrompt } from "./patterns/heroVariations";
export { colorHarmonyPrompt } from "./design/colorHarmony";
export { antiPatternsPrompt } from "./design/antiPatterns";
export { sectionRecipesPrompt } from "./patterns/sectionRecipes";
export { fontAndResponsivePrompt } from "./design/fontAndResponsive";
export { surfaceHarmonyPrompt } from "./design/surfaceHarmony";
export { imageStrategyPrompt } from "./patterns/imageStrategy";
export { designChecklistPrompt } from "./designChecklist";
export { gradientRecipesPrompt } from "./patterns/gradientRecipes";
export type {
  CodingPromptState,
  CodingPromptFn,
  TypographyRecommendations,
  TypographyCategory,
  TypographyRecommendation,
  ThemeAPIResponse,
  SemanticVariables,
} from "./types";
