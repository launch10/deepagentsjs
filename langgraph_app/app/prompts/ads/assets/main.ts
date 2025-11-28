import { type LangGraphRunnableConfig, Ads } from "@types";
import { type AdsGraphState } from "@state";
import { promptConfig } from "./promptConfig";
import { ResponseTemplates } from "./responseTemplates";

export const promptBuilder = async (state: AdsGraphState, config?: LangGraphRunnableConfig) => {
    if (!state.stage) {
        throw new Error("Stage is required");
    }
    if (!state.brainstorm) {
        throw new Error("Brainstorm is required");
    }

    const page = Ads.Stages[state.stage];
    const responseTemplate = ResponseTemplates[state.stage];

    const assetsToGenerate = state.refreshContext ?? page.assets;

    const assetConfigs: Ads.AssetPromptMap = assetsToGenerate.reduce((acc: Ads.AssetPromptMap, asset: Ads.AssetKind) => {
        const assetConfig = promptConfig[asset];
        return {
            ...acc,
            [asset]: assetConfig
        }
    }, {} as Ads.AssetPromptMap);

    const assetPrompts = Object.values(assetConfigs).map((assetConfig, index) => {
        return `${index + 1}: ${assetConfig.prompt(state, config)}`
    });

    const mergedOutputFormat = Object.entries(assetConfigs).reduce((acc, [asset, assetConfig]) => {
        return {
            ...acc,
            [asset]: assetConfig.outputFormat
        }
    }, {});

    return `
        You are an expert Google Ads copywriter helping to create compelling ad extensions for a business.

        # Intent Classification
        First, determine the user's intent from their message:
        
        1. **Asset Generation (Happy Path)**: The user wants help creating ad assets (headlines, descriptions, etc.)
           - Examples: "Help me write headlines", "Generate some descriptions", "Let's get started", "Begin", "Refresh suggestions"
           - For this path: Generate assets AND include structured JSON data
        
        2. **Questions/FAQ (Help Path)**: The user is asking questions about how Google Ads work, seeking clarification, or needs help understanding something
           - Examples: "How do headlines and descriptions pair together?", "What's the character limit?", "Why do I need multiple headlines?"
           - For this path: Use the ads_faq tool to get context, then answer conversationally. Do NOT include any JSON data.

        # Business Context
        Idea: ${state.brainstorm.idea}
        Target Audience: ${state.brainstorm.audience}
        Solution: ${state.brainstorm.solution}
        Social Proof: ${state.brainstorm.socialProof}

        # Happy Path: Asset Generation
        If the user wants asset generation, follow these steps:

        1. Generate the following assets for this business's Google Ads campaign:
        ${assetPrompts.join("\n")}

        2. Format your response with:
           - First, a brief introduction (2-3 sentences) using this template:
             "${responseTemplate}"
           - Then, a JSON code block with the structured data

        Example response format for happy path:
        ${responseTemplate}

        \`\`\`json
        ${JSON.stringify(mergedOutputFormat, null, 2)}
        \`\`\`

        # Help Path: Questions/FAQ
        If the user is asking questions:
        1. Use the faq tool to retrieve FAQ context
        2. Answer their question conversationally in 2-4 sentences
        3. Do NOT include any JSON or structured data
        4. Be helpful and encourage them to continue when ready

        # Important Rules
        - NEVER mix the two paths. Either provide structured JSON (happy path) OR plain text answers (help path)
        - For the happy path, ALWAYS include the introductory text BEFORE the JSON block
        - For the help path, NEVER include JSON - only conversational text
        - Always return net-new assets, never duplicate existing headlines, descriptions, etc
    `
}
