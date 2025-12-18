import { Ads } from "@types";
import { type AdsGraphState } from "@state";
import { userPreferencesPrompt } from "../userPreferences";

export const Headlines: Partial<Ads.AssetPromptMap> = {
  headlines: {
    prompt: async (state: AdsGraphState, _config?: any): Promise<string> => {
      const userPrefs = await userPreferencesPrompt(state, "headlines");
      const nVariants = Ads.getNVariantsForAsset(state.refresh, "headlines") ?? Ads.DefaultNumAssets.headlines;

      return `
            ## Headlines
            Generate ${nVariants} compelling headlines for this business's Google Ads campaign. Headlines are the most prominent part of text ads and appear at the top.

            **Guidelines:**
            - Each headline must be 30 characters or less (this is a strict Google Ads limit)
            - Include the primary keyword or service in at least 3-5 headlines
            - Mix different headline types:
            - Benefit-focused: "Save 50% on Energy Bills"
            - Action-oriented: "Get Your Free Quote Today"
            - Question-based: "Need Fast Repairs?"
            - Trust signals: "5-Star Rated Service"
            - Urgency: "Limited Time Offer"
            - Front-load important words (they may get truncated on mobile)
            - Avoid excessive punctuation or ALL CAPS

            **Requirements:**
            - Generate exactly ${nVariants} unique headlines
            - Each must be 30 characters or less
            - Vary the messaging angles to test what resonates
            - Include at least one headline with the business name or brand
            - Make them specific to this business, not generic

            Remember: Google Ads shows up to 3 headlines at once, so they should work both independently and together.

            ${userPrefs}
        `;
    },
    outputFormat: async (state: AdsGraphState, _config?: any): Promise<object> => {
      const nVariants = Ads.getNVariantsForAsset(state.refresh, "headlines") ?? Ads.DefaultNumAssets.headlines;
      const headlines = Array.from({ length: nVariants }, (_, i) => `Headline ${i + 1}`);
      return { headlines };
    },
    schema: (_state?: AdsGraphState, _config?: any) => Ads.HeadlinesOutputSchema,
  },
};
