/**
 * Types for coding agent prompts.
 * All prompts follow the async (state, config) pattern for consistency.
 */
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { paths } from "@rails_api";

/**
 * Theme response from the Rails API.
 * Uses Rswag-generated types for type safety.
 */
export type ThemeAPIResponse =
  paths["/api/v1/themes/{id}"]["get"]["responses"]["200"]["content"]["application/json"];

/**
 * Typography recommendation from the Rails API.
 */
export type TypographyRecommendation = NonNullable<
  ThemeAPIResponse["typography_recommendations"]
>[string]["headlines"][number];

/**
 * Typography category (headlines, subheadlines, body, accents) from the Rails API.
 */
export type TypographyCategory = NonNullable<
  ThemeAPIResponse["typography_recommendations"]
>[string];

/**
 * Typography recommendations keyed by background color from the Rails API.
 */
export type TypographyRecommendations = ThemeAPIResponse["typography_recommendations"];

/**
 * State required by coding prompts.
 * Minimal subset of WebsiteGraphState needed for prompt generation.
 */
/**
 * Semantic CSS variables from the theme (HSL values).
 * Keys are CSS custom property names like '--background', '--primary', etc.
 */
export type SemanticVariables = Record<string, string>;

export interface CodingPromptState {
  websiteId?: number;
  jwt?: string;
  theme?: {
    id?: number;
    name?: string;
    colors?: string[];
    /** Semantic CSS variables (HSL values) */
    semanticVariables?: SemanticVariables;
    typography_recommendations?: TypographyRecommendations;
  };
  /**
   * Whether this is the first user message in the conversation.
   * Determines if we're creating from scratch or editing existing content.
   */
  isCreateFlow: boolean;
  /**
   * Error context for bug fixing scenarios.
   * Passed via state rather than as a separate parameter for consistency.
   */
  errors?: string;
}

/**
 * Standard signature for all coding agent prompts.
 * Async to allow API calls, accepts state and optional config.
 */
export type CodingPromptFn = (
  state: CodingPromptState,
  config?: LangGraphRunnableConfig
) => Promise<string>;
