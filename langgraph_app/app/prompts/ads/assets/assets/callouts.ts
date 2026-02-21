import { Ads } from "@types";
import { type AdsGraphState } from "@state";

export const Callouts: Partial<Ads.AssetPromptMap> = {
  callouts: {
    prompt: async (state: AdsGraphState, _config?: any) => {
      const lockedCount = (state.callouts || []).filter((a) => a.locked).length;
      const nVariants =
        Ads.getNVariantsForAsset(state.refresh, "callouts") ??
        Math.max(1, Ads.DefaultNumAssets.callouts - lockedCount);

      return `
            ## Unique Features (Callouts)
            Generate ${nVariants} unique selling points that highlight why customers should choose this business. These appear as callout extensions in Google Ads.

            **Guidelines:**
            - Keep each feature concise and punchy (no more than ${Ads.FakeAssetLengths.callouts} characters)
            - Focus on competitive advantages, special offers, or key differentiators
            - Use action-oriented language when possible
            - Examples: "Free Fast Delivery", "10% Student Discount", "30-Day Free Returns", "No Obligation Estimate", "35+ Years Experience", "Family Owned"

            **Requirements:**
            - Generate exactly ${nVariants} unique features
            - Each must be ${Ads.FakeAssetLengths.callouts} characters or less
            - Avoid generic phrases - be specific to this business
            - Focus on tangible benefits or proof points

            Remember: These highlights make the ad larger and give potential customers more reasons to click. Make them compelling, specific, and relevant to the business's unique value proposition.
        `;
    },
    outputFormat: async (state: AdsGraphState, _config?: any): Promise<object> => {
      const lockedCount = (state.callouts || []).filter((a) => a.locked).length;
      const nVariants =
        Ads.getNVariantsForAsset(state.refresh, "callouts") ??
        Math.max(1, Ads.DefaultNumAssets.callouts - lockedCount);
      const callouts = Array.from({ length: nVariants }, (_, i) => `Feature ${i + 1}`);
      return { callouts };
    },
    schema: (_state?: AdsGraphState, _config?: any) => Ads.CalloutsOutputSchema,
  },
};
