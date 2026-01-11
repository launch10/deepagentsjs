/**
 * Shared prompt components for coding agents.
 * All prompts follow the async (state, config) pattern.
 */
export { trackingContextPrompt } from "./trackingContext";
export { codeGuidelinesPrompt } from "./codeGuidelines";
export { environmentPrompt } from "./environment";
export { fileStructurePrompt } from "./fileStructure";
export { themeColorsPrompt } from "./themeColors";
export { typographyPrompt, formatTypographyPrompt } from "./typography";
export { codingToolsPrompt } from "./tools";
export { workflowPrompt, startByPrompt } from "./workflow";
export { contextPrompt } from "./context";
export { userGoalPrompt } from "./goal";
export { rolePrompt } from "./role";
export type {
  CodingPromptState,
  CodingPromptFn,
  TypographyRecommendations,
  TypographyCategory,
  TypographyRecommendation,
  ThemeAPIResponse,
} from "./types";
