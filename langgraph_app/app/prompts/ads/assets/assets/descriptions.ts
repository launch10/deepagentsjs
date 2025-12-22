import { Ads } from "@types";
import { type AdsGraphState } from "@state";
import { userPreferencesPrompt } from "../userPreferences";

export const Descriptions: Partial<Ads.AssetPromptMap> = {
  descriptions: {
    prompt: async (state: AdsGraphState, _config?: any) => {
      const userPrefs = await userPreferencesPrompt(state, "descriptions");
      const nVariants =
        Ads.getNVariantsForAsset(state.refresh, "descriptions") ??
        Ads.DefaultNumAssets.descriptions;

      return `
            ## Descriptions
            Generate ${nVariants} compelling descriptions for this business's Google Ads campaign. Descriptions appear below the headlines and provide more detail about the offer.

            **Guidelines:**
            - Each description must be ${Ads.FakeAssetLengths.descriptions} characters or less (this is a strict Google Ads limit)
            - Expand on the value proposition introduced in headlines
            - Include a clear call-to-action in at least 2 descriptions
            - Mix different approaches:
              - Feature-benefit: "Professional installation with lifetime warranty included."
              - Social proof: "Trusted by 10,000+ customers. See why they chose us."
              - Urgency/offer: "Book today and get 20% off your first service. Limited spots."
              - Problem-solution: "Tired of high energy bills? Our solutions cut costs by 40%."
            - Use complete sentences when possible
            - Include relevant keywords naturally

            **Requirements:**
            - Generate exactly ${nVariants} unique descriptions
            - Each must be ${Ads.FakeAssetLengths.descriptions} characters or less (hard limit)
            - At least 2 should include a call-to-action (e.g., "Call now", "Get a quote", "Shop today")
            - Make them specific to this business's offerings and benefits
            - Avoid repeating the same information across descriptions

            Remember: Google Ads shows up to 2 descriptions at once. They should complement the headlines and give users a reason to click.

            ${userPrefs}
        `;
    },
    outputFormat: async (state: AdsGraphState, _config?: any): Promise<object> => {
      const nVariants =
        Ads.getNVariantsForAsset(state.refresh, "descriptions") ??
        Ads.DefaultNumAssets.descriptions;
      const descriptions = Array.from({ length: nVariants }, (_, i) => `Description ${i + 1}`);
      return { descriptions };
    },
    schema: (_state?: AdsGraphState, _config?: any) => Ads.DescriptionsOutputSchema,
  },
};
