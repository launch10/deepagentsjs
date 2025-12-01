import { type LangGraphRunnableConfig, Ads } from "@types";
import { type AdsGraphState } from "@state";
import { AssetPrompts } from "./config";
import { needsIntentClassification } from "../helpers";
import { ResponseTemplates } from "./responseTemplates";

export const getAssetPrompts = async (state: AdsGraphState, config: LangGraphRunnableConfig): Promise<string> => {
    const assetConfigs = getAssetsConfigs(state);

    const prompts = await Promise.all(Object.values(assetConfigs).map(async (assetConfig, index) => {
        const prompt = await assetConfig.prompt(state, config);
        return `${index + 1}: ${prompt.trim()}`
    }));

    return `
        <asset_instructions>
            ${prompts.map((prompt, index) => {
                return `<instruction index="${index + 1}">${prompt}</instruction>`;
            }).join("\n")}
        </asset_instructions>
    `;
}

export const getOutputPrompt = async (state: AdsGraphState, config: LangGraphRunnableConfig): Promise<string> => {
    const assetConfigs = getAssetsConfigs(state);

    const arrayOfOutputFormats = await Promise.all(Object.values(assetConfigs).map(async (assetConfig) => {
        return await assetConfig.outputFormat(state, config);
    }));
    const outputFormat = arrayOfOutputFormats.reduce((acc, formatObj) => ({ ...acc, ...formatObj }), {});
    const needsIntent = needsIntentClassification(state);
    const isRefreshMode = state.refresh !== undefined;
    const stage = state.stage as Ads.StageName;
    const responseTemplate = ResponseTemplates[stage];
    const assetResponse = `
        ${isRefreshMode ? "Here are some fresh suggestions:" : responseTemplate}

        \`\`\`json
        ${JSON.stringify(outputFormat, null, 2)}
        \`\`\`
    `;

    if (needsIntent) {
        return `
        <example_responses>
            <asset_generation>
                ## If generating assets (Happy Path):
                ${assetResponse}
            </asset_generation>

            <help_path>
                ## If answering questions (Help Path):
                [2-3 sentence conversational answer - NO JSON block]
                [IMPORTANT: If answering question: keep it brief, 2-3 sentences only. No JSON block.]
            </help_path>
        </example_responses>
    ` } else {
        return `
            <example_response>
                ${assetResponse}
            </example_response>
        `;
    }
}

const getAssetsConfigs = (state: AdsGraphState): Ads.AssetPromptMap => {
    if (!state.stage) {
        throw new Error("Stage is required");
    }

    const stage = Ads.Stages[state.stage];
    const assetsToGenerate: Ads.AssetKind[] = state.refresh?.asset ? [state.refresh.asset] : stage.assets;

    const assetConfigs: Ads.AssetPromptMap = assetsToGenerate.reduce((acc: Ads.AssetPromptMap, asset: Ads.AssetKind) => {
        const assetConfig = AssetPrompts[asset];
        return {
            ...acc,
            [asset]: assetConfig
        }
    }, {} as Ads.AssetPromptMap);

    return assetConfigs;
}