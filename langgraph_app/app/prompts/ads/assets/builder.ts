import { type LangGraphRunnableConfig, Ads } from "@types";
import { type AdsGraphState } from "@state";
import { promptConfig } from "./promptConfig";

// User clicks button "Refresh Suggestions" for headlines,
// state includes page: "Content", command: refreshSuggestions,
// assets: ["headlines"]
export const promptBuilder = async (state: AdsGraphState, config?: LangGraphRunnableConfig) => {
    if (!state.stage) {
        throw new Error("Stage is required");
    }

    const page = Ads.Stages[state.stage];

    const assetConfigs: Ads.AssetPromptMap = page.assets.reduce((acc: Ads.AssetPromptMap, asset: Ads.AssetKind) => {
        const assetConfig = promptConfig[asset];
        return {
            ...acc,
            [asset]: assetConfig
        }
    }, {} as Ads.AssetPromptMap);

    const assetPrompts = Object.values(assetConfigs).map((assetConfig, index) => {
        return `${index + 1}: ${assetConfig.prompt}`
    });

    // Merge this into a single output format
    const mergedOutputFormat = Object.entries(assetConfigs).reduce((acc, [asset, assetConfig]) => {
        return {
            ...acc,
            [asset]: assetConfig.outputFormat
        }
    }, {});

    return `
        You are an expert Google Ads copywriter helping to create compelling ad extensions for a business. 

        # Business Context
        {business_context}

        # Your Task
        Generate the following assets for this business's Google Ads campaign:

        ${assetPrompts.join("\n")}

        # Output Format
        Return your response as a JSON object with this structure:
        ${JSON.stringify(mergedOutputFormat)}
    `
}