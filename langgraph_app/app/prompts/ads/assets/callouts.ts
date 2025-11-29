import { Ads } from "@types";
import { type AdsGraphState } from "@state";
import { userPreferencesPrompt } from "./userPreferences";

export const Callouts: Partial<Ads.AssetPromptMap> = {
    "callouts": {
        prompt: async (state: AdsGraphState, _config?: any) => {
            const userPrefs = await userPreferencesPrompt(state, "callouts");
            const nVariants = state.refresh?.nVariants || Ads.DefaultNumAssets.callouts;

            return `
            ## Unique Features (Callouts)
            Generate ${nVariants} unique selling points that highlight why customers should choose this business. These appear as callout extensions in Google Ads.

            **Guidelines:**
            - Keep each feature concise and punchy (typically 12-25 characters)
            - Focus on competitive advantages, special offers, or key differentiators
            - Use action-oriented language when possible
            - Examples: "Free Fast Delivery", "10% Student Discount", "30-Day Free Returns", "No Obligation Estimate", "35+ Years Experience", "Family Owned"

            **Requirements:**
            - Generate exactly ${nVariants} unique features
            - Each must be 25 characters or less
            - Avoid generic phrases - be specific to this business
            - Focus on tangible benefits or proof points

            Remember: These highlights make the ad larger and give potential customers more reasons to click. Make them compelling, specific, and relevant to the business's unique value proposition.

            ${userPrefs}
        `;
        },
        outputFormat: async (state: AdsGraphState, _config?: any): Promise<object> => {
            const nVariants = state.refresh?.nVariants || Ads.DefaultNumAssets.callouts;
            const callouts = Array.from({ length: nVariants }, (_, i) => `Feature ${i + 1}`);
            console.log(`nVariants... ${nVariants}`);
            return { callouts };
        }
    }
}
