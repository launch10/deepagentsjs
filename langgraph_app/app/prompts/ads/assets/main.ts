import { type LangGraphRunnableConfig, Ads } from "@types";
import { type AdsGraphState } from "@state";
import { promptConfig } from "./promptConfig";
import { ResponseTemplates } from "./responseTemplates";
import { isPseudoMessage } from "../pseudoMessages";
import { HumanMessage } from "@langchain/core/messages";

export const promptBuilder = async (state: AdsGraphState, config?: LangGraphRunnableConfig) => {
    if (!state.stage) {
        throw new Error("Stage is required");
    }
    if (!state.brainstorm) {
        throw new Error("Brainstorm is required");
    }

    const page = Ads.Stages[state.stage];
    const responseTemplate = ResponseTemplates[state.stage];

    const assetsToGenerate: Ads.AssetKind[] = state.refresh?.asset ? [state.refresh.asset] : page.assets;

    const assetConfigs: Ads.AssetPromptMap = assetsToGenerate.reduce((acc: Ads.AssetPromptMap, asset: Ads.AssetKind) => {
        const assetConfig = promptConfig[asset];
        return {
            ...acc,
            [asset]: assetConfig
        }
    }, {} as Ads.AssetPromptMap);

    const assetPrompts = await Promise.all(Object.values(assetConfigs).map(async (assetConfig, index) => {
        const prompt = await assetConfig.prompt(state, config);
        return `${index + 1}: ${prompt.trim()}`
    }));

    const arrayOfOutputFormats = await Promise.all(Object.values(assetConfigs).map(async (assetConfig) => {
        return await assetConfig.outputFormat(state, config);
    }));
    const mergedOutputFormat = arrayOfOutputFormats.reduce((acc, formatObj) => ({ ...acc, ...formatObj }), {});

    const lastMessage = state.messages?.at(-1);
    const isRealHumanMessage = lastMessage && HumanMessage.isInstance(lastMessage) && !isPseudoMessage(lastMessage);
    const needsIntentClassification = isRealHumanMessage;
    const isRefreshMode = state.refresh !== undefined;

    const intentClassificationSection = needsIntentClassification ? `
        # Intent Classification
        First, determine the user's intent from their message:
        
        1. **Asset Generation (Happy Path)**: The user wants help creating ad assets (headlines, descriptions, etc.)
           - Examples: "Help me write headlines", "Generate some descriptions", "Let's get started", "Begin", "Refresh suggestions"
           - For this path: Generate assets AND include structured JSON data
        
        2. **Questions/FAQ (Help Path)**: The user is asking questions about how Google Ads work, seeking clarification, or needs help understanding something
           - Examples: "How do headlines and descriptions pair together?", "What's the character limit?", "Why do I need multiple headlines?"
           - For this path: Use the ads_faq tool to get context, then answer conversationally. Do NOT include any JSON data.
    ` : '';

    const refreshModeSection = isRefreshMode ? `
        # REFRESH MODE
        The user clicked the refresh button for ${state.refresh!.asset}. 
        Generate exactly ${state.refresh!.nVariants} NEW ${state.refresh!.asset}(s).
        DO NOT summarize, explain, or ask questions - just generate the assets with a brief intro and the JSON block.
        Ignore any previous conversation context - this is a fresh generation request.
    ` : '';

    const helpPathSection = needsIntentClassification ? `
        # Help Path: Questions/FAQ
        If the user is asking questions:
        1. Use the faq tool to retrieve FAQ context
        2. Answer their question conversationally in 2-4 sentences
        3. Do NOT include any JSON or structured data
        4. Be helpful and encourage them to continue when ready
    ` : '';

    const importantRulesSection = needsIntentClassification ? `
        # Important Rules
        - NEVER mix the two paths. Either provide structured JSON (happy path) OR plain text answers (help path)
        - For the happy path, ALWAYS include the introductory text BEFORE the JSON block
        - For the help path, NEVER include JSON - only conversational text
        - Always return net-new assets, never duplicate existing headlines, descriptions, etc
    ` : `
        # Important Rules
        - ALWAYS include the introductory text BEFORE the JSON block
        - Always return net-new assets, never duplicate existing headlines, descriptions, etc
    `;

    return `
        You are an expert Google Ads copywriter helping to create compelling ad extensions for a business.
        ${intentClassificationSection}

        ${helpPathSection}

        # Asset Generation
        ${needsIntentClassification ? 'If the user wants asset generation, follow these steps:' : 'Generate the following assets:'}

        1. Generate the following assets for this business's Google Ads campaign:
        ${assetPrompts.join("\n")}

        2. Format your response with:
           - First, a brief introduction (1-2 sentences)${!isRefreshMode ? ` using this template:
             "${responseTemplate}"` : ''}
           - Then, a JSON code block with the structured data

        ${refreshModeSection}

        ${importantRulesSection}

        # Business Context
        Idea: ${state.brainstorm.idea}
        Target Audience: ${state.brainstorm.audience}
        Solution: ${state.brainstorm.solution}
        Social Proof: ${state.brainstorm.socialProof}

        Example response format:
        ${isRefreshMode ? "Here are some fresh suggestions:" : responseTemplate}

        \`\`\`json
        ${JSON.stringify(mergedOutputFormat, null, 2)}
        \`\`\`
    `.replace(/\n\s*\n/g, '\n\n').trim();
}
