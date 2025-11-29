import { type Ads } from "@types";
import { type AdsGraphState } from "@state";
import { userPreferencesPrompt } from "./userPreferences";

export const StructuredSnippets: Partial<Ads.AssetPromptMap> = {
    "structured_snippets": {
        prompt: async (state: AdsGraphState, _config?: any) => {
            const snippetCategory = state?.structuredSnippet?.category?.text
            const userPrefs = await userPreferencesPrompt(state, "structured_snippets");
            const numberOfDetails = state?.refresh?.nVariants || 3;

            return `
            ## Product or Service Offerings (Structured Snippets)
            Generate a category header and ${numberOfDetails}-10 specific examples of what this business offers. These appear as structured snippet extensions in Google Ads.

            **Category Header:**
            ${
                snippetCategory ? snippetCategory : `Choose ONE header that best describes what you're listing (e.g., "Types", "Services", "Amenities", "Products", "Styles", "Brands", "Courses", "Destinations")`
            }

            **Details (Values):**
            List 3-10 specific offerings under that category header.
            - Examples: 
              - Types: "Web Design", "SEO", "Content Marketing"
              - Amenities: "Free WiFi", "Free Parking", "Included Breakfast", "Spa Services"
              - Services: "Emergency Repairs", "Annual Maintenance", "Free Estimates"

            **Requirements:**
            - Choose an appropriate category header
            - Generate ${numberOfDetails} specific, relevant details
            - Each detail should be 25 characters or less
            - Be specific to this business's actual offerings


            ${userPrefs}
        `;
        },
        outputFormat: async (state: AdsGraphState, _config?: any): Promise<object> => {
            const numberOfDetails = state?.refresh?.nVariants || 3;
            return {
                structuredSnippet: {
                    category: "Types",
                    details: Array.from({ length: numberOfDetails }, (_, i) => `Detail ${i + 1}`)
                }
            };
        }
    }
}