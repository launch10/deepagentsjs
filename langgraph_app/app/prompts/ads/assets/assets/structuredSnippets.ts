import { Ads } from "@types";
import { type AdsGraphState } from "@state";
import { userPreferencesPrompt } from "../userPreferences";

export const StructuredSnippetss: Partial<Ads.AssetPromptMap> = {
  structuredSnippets: {
    prompt: async (state: AdsGraphState, _config?: any) => {
      const snippetCategory = state?.structuredSnippets?.category;
      const userPrefs = await userPreferencesPrompt(state, "structuredSnippets");
      const numberOfDetails = state?.refresh?.nVariants || Ads.DefaultNumAssets.structuredSnippets;

      return `
            ## Product or Service Offerings (Structured Snippets)
            Generate a category header and ${numberOfDetails} specific examples of what this business offers. These appear as structured snippet extensions in Google Ads.

            **Category Header:**
            ${
              snippetCategory
                ? snippetCategory
                : `Choose ONE header that best describes what you're listing (e.g., "Types", "Services", "Amenities", "Products", "Styles", "Brands", "Courses", "Destinations")`
            }

            **Details (Values):**
            List ${numberOfDetails} specific offerings under that category header.
            - Examples: 
              - Types: "Web Design", "SEO", "Content Marketing"
              - Amenities: "Free WiFi", "Free Parking", "Included Breakfast", "Spa Services"
              - Services: "Emergency Repairs", "Annual Maintenance", "Free Estimates"

            **Requirements:**
            - Choose an appropriate category header
            - Generate exactly ${numberOfDetails} specific, relevant details
            - Do not generate more than ${numberOfDetails} details
            - Each detail should be 25 characters or less
            - Be specific to this business's actual offerings

            ${userPrefs}
        `;
    },
    outputFormat: async (state: AdsGraphState, _config?: any): Promise<object> => {
      const numberOfDetails = state?.refresh?.nVariants || Ads.DefaultNumAssets.structuredSnippets;
      return {
        structuredSnippets: {
          category: "Types",
          details: Array.from({ length: numberOfDetails }, (_, i) => `Detail ${i + 1}`),
        },
      };
    },
  },
};
