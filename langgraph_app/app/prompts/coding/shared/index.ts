/**
 * Shared prompt components for coding agents.
 * All prompts follow the async (state, config) pattern.
 */
export { trackingPrompt } from "./tracking";
export { codeGuidelinesPrompt } from "./codeGuidelines";
export { environmentPrompt } from "./environment";
export { fileStructurePrompt } from "./fileStructure";
export { iconsPrompt } from "./icons";
export { typographyPrompt, formatTypographyPrompt } from "./design/typography";
export { codingToolsPrompt } from "./tools";
export { workflowPrompt, startByPrompt } from "./workflow";
export { contextPrompt } from "./context";
export { userGoalPrompt } from "./goal";
export { rolePrompt } from "./role";
export { linksPrompt } from "./links";
export { imagesPrompt } from "./images";
export { animationsPrompt } from "./design/animations";
export { themeColorsPrompt } from "./design/themeColors";
export { fontAndResponsivePrompt } from "./design/fonts";
export { imageStrategyPrompt } from "./design/imageStrategy";
export { designChecklistPrompt } from "./design/designChecklist";
export type {
  CodingPromptState,
  CodingPromptFn,
  TypographyRecommendations,
  TypographyCategory,
  TypographyRecommendation,
  ThemeAPIResponse,
  SemanticVariables,
} from "./types";
