import { Ads } from "@types";
import { type AdsGraphState } from "@state";

const categoryList = Ads.StructuredSnippetCategoryKeys;

const categoryExamples = Ads.StructuredSnippetCategoryKeys.slice(0, 3)
  .map((key) => `- ${Ads.StructuredSnippetCategories[key].examples}`)
  .join("\n              ");

export const StructuredSnippets: Partial<Ads.AssetPromptMap> = {
  structuredSnippets: {
    prompt: async (state: AdsGraphState, _config?: any) => {
      const snippetCategory = state?.structuredSnippets?.category;
      const lockedCount = (state.structuredSnippets?.details || []).filter((a) => a.locked).length;
      const numberOfDetails =
        Ads.getNVariantsForAsset(state.refresh, "structuredSnippets") ??
        Math.max(1, Ads.DefaultNumAssets.structuredSnippets - lockedCount);

      return `
            ## Product or Service Offerings (Structured Snippets)
            Generate a category header and ${numberOfDetails} specific examples of what this business offers. These appear as structured snippet extensions in Google Ads.

            **Category Header:**
            ${
              snippetCategory
                ? snippetCategory
                : `Choose ONE header that best describes what you're listing (e.g., ${categoryList})`
            }

            **Details (Values):**
            List ${numberOfDetails} specific offerings under that category header.
            - Examples: 
              ${categoryExamples}

            **Requirements:**
            - Choose an appropriate category header
            - Generate exactly ${numberOfDetails} specific, relevant details
            - Do not generate more than ${numberOfDetails} details
            - Each detail should be ${Ads.FakeAssetLengths.structuredSnippets} characters or less
            - Be specific to this business's actual offerings
        `;
    },
    outputFormat: async (state: AdsGraphState, _config?: any): Promise<object> => {
      const lockedCount = (state.structuredSnippets?.details || []).filter((a) => a.locked).length;
      const numberOfDetails =
        Ads.getNVariantsForAsset(state.refresh, "structuredSnippets") ??
        Math.max(1, Ads.DefaultNumAssets.structuredSnippets - lockedCount);
      return {
        structuredSnippets: {
          category: "types", // Use keys like "types", "services", "brands" - not display names
          details: Array.from({ length: numberOfDetails }, (_, i) => `Detail ${i + 1}`),
        },
      };
    },
    schema: (_state?: AdsGraphState, _config?: any) => Ads.StructuredSnippetsOutputSchema,
  },
};
