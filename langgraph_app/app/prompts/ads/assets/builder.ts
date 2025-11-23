import { type LangGraphRunnableConfig, Ads } from "@types";

const AssetConfigs: Ads.AssetPromptMap = {
    "unique_features": {
    },
    "structured_snippets": {
        prompt: `Generate 6 unique structured snippets for this business's Google Ads campaign.`,
        outputFormat: `
            "structured_snippets": [
                "Snippet 1",
                "Snippet 2",
                "Snippet 3",
                "Snippet 4",
                "Snippet 5",
                "Snippet 6"
            ]
        `
    }
}

// User clicks button "Refresh Suggestions" for headlines,
// state includes page: "Content", command: refreshSuggestions,
// assets: ["headlines"]
export const promptBuilder = async (state: any, config?: LangGraphRunnableConfig) => {
    const page = Ads.Pages[state.page];

    const assetConfigs: Ads.AssetPromptMap = page.assets.reduce((acc: Ads.AssetPromptMap, asset: Ads.AssetKind) => {
        const assetConfig = AssetConfigs[asset];
        return {
            ...acc,
            [asset]: assetConfig
        }
    }, {} as Ads.AssetPromptMap);

    return `
        You are an expert Google Ads copywriter helping to create compelling ad extensions for a business. You will generate Unique Features and Product/Service Offerings that will appear as Highlights in their Google Search ad.

        # Business Context
        {business_context}

        # Your Task
        Generate the following assets for this business's Google Ads campaign:

        # Output Format
        Return your response as a JSON object with this structure:
        ${config?.outputFormat}
    `
}