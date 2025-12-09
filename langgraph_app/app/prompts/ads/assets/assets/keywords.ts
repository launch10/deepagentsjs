import { type AdsGraphState } from "@state";
import { userPreferencesPrompt } from "../userPreferences";
import { Ads } from "@types";

export const Keywords: Partial<Ads.AssetPromptMap> = {
  keywords: {
    prompt: async (state: AdsGraphState, _config?: any) => {
      const userPrefs = await userPreferencesPrompt(state, "keywords");
      const nVariants = state.refresh?.nVariants || Ads.DefaultNumAssets.keywords;

      return `
            ## Keywords
            Generate ${nVariants} targeted keywords for this business's Google Ads campaign. Keywords determine when your ads appear in search results.

            **Guidelines:**
            - Include a mix of keyword types:
              - Brand keywords: Business name and variations
              - Product/Service keywords: What the business offers
              - Problem keywords: What customers search when they have an issue
              - Competitor keywords: Alternative solutions customers might search
              - Location keywords: If the business serves specific areas
            - Consider search intent:
              - Transactional: "buy", "hire", "get quote", "near me"
              - Informational: "how to", "best", "reviews"
              - Commercial: "pricing", "cost", "compare"
            - Use natural language phrases (Google handles match types separately)

            **Requirements:**
            - Generate exactly ${nVariants} unique keywords
            - Include 3-5 high-intent transactional keywords
            - Include 3-5 broader awareness keywords
            - Include at least 2 location-based keywords if applicable
            - Focus on keywords with clear commercial intent
            - Avoid overly broad single words (e.g., just "plumber" - prefer "emergency plumber near me")

            **Keyword Format:**
            - Use lowercase
            - 1-5 words per keyword phrase
            - No special characters or punctuation

            Remember: Quality keywords connect your ads with people actively searching for what you offer. Focus on relevance and intent over volume.

            ${userPrefs}
        `;
    },
    outputFormat: async (state: AdsGraphState, _config?: any): Promise<object> => {
      const nVariants = state.refresh?.nVariants || Ads.DefaultNumAssets.keywords;
      const keywords = Array.from({ length: nVariants }, (_, i) => `Keyword ${i + 1}`);
      return { keywords };
    },
  },
};
