import { type LangGraphRunnableConfig, Ads } from "@types";
import { type AdsGraphState } from "@state";
import { getAssetPrompts, getOutputPrompt } from "./assets/index";
import { needsIntentClassification } from "./helpers";
import { ResponseTemplates } from "./assets/responseTemplates";
import { previousAssetsContext } from "./helpers/previousAssetsContext";

const buildPreviousAssetsContext = (state: AdsGraphState): string => {
    const sections = previousAssetsContext(state);
    
    if (!sections.length) return '';

    return `
        # User Preferences from Previous Steps
        The user has already reviewed some assets. Use their preferences to guide new generations:
        ${sections.join('\n\n')}

        Generate new assets that complement the approved ones and avoid themes similar to rejected ones.
    `;
};

const buildIntentSection = (state: AdsGraphState): string => {
    const needsIntent = needsIntentClassification(state);

    if (!needsIntent) return '';
    
    return `
        # Intent Classification
        First, determine the user's intent from their message:
        
        1. **Asset Generation (Happy Path)**: The user wants help creating ad assets (headlines, descriptions, etc.)
           - Examples: "Help me write headlines", "Generate some descriptions", "Let's get started", "Begin", "Refresh suggestions"
           - For this path: Generate assets AND include structured JSON data
        
        2. **Questions/FAQ (Help Path)**: The user is asking questions about how Google Ads work, seeking clarification, or needs help understanding something
           - Examples: "How do headlines and descriptions pair together?", "What's the character limit?", "Why do I need multiple headlines?"
           - For this path: Use the ads_faq tool to get context, then answer conversationally. Do NOT include any JSON data.
    `;
};

const buildRefreshSection = (state: AdsGraphState): string => {
    if (!state.refresh) return '';
    
    return `
        # REFRESH MODE
        The user clicked the refresh button for ${state.refresh.asset}. 
        Generate exactly ${state.refresh.nVariants} NEW ${state.refresh.asset}(s).
        DO NOT summarize, explain, or ask questions - just generate the assets with a brief intro and the JSON block.
        Ignore any previous conversation context - this is a fresh generation request.
    `;
};

const buildHelpSection = (state: AdsGraphState): string => {
    const needsIntent = needsIntentClassification(state);

    if (!needsIntent) return '';
    
    return `
        # Help Path: Questions/FAQ
        If the user is asking questions:
        1. Use the ads_faq tool to retrieve FAQ context
        2. Answer their question in 2-3 sentences maximum
        3. Do NOT include any JSON or structured data
        4. Keep your answer brief and helpful
    `;
};

const buildRulesSection = (state: AdsGraphState): string => {
    const needsIntent = needsIntentClassification(state);
    if (!needsIntent) return '';
    
    return `
        # Important Rules
        - NEVER mix the two paths. Either provide structured JSON (happy path) OR plain text answers (help path)
        - For the happy path, ALWAYS include the introductory text BEFORE the JSON block
        - For the help path, NEVER include JSON - only conversational text
        - Always return net-new assets, never duplicate existing headlines, descriptions, etc
    `;
};

export const promptBuilder = async (state: AdsGraphState, config: LangGraphRunnableConfig) => {
    if (!state.stage) {
        throw new Error("Stage is required");
    }
    if (!state.brainstorm) {
        throw new Error("Brainstorm is required");
    }

    const responseTemplate = ResponseTemplates[state.stage];
    const isRefreshMode = state.refresh !== undefined;
    const previousAssetsContext = buildPreviousAssetsContext(state);
    const refreshSection = buildRefreshSection(state);
    const helpSection = buildHelpSection(state);
    const rulesSection = buildRulesSection(state);
    const intentClassificationSection = buildIntentSection(state);
    const assetPrompts = await getAssetPrompts(state, config);
    const outputPrompt = await getOutputPrompt(state, config);

    return `
        You are an expert Google Ads copywriter helping to create compelling ad extensions for a business.
        ${intentClassificationSection}

        ${helpSection}

        # Asset Generation
        ${needsIntentClassification(state) ? 'If the user wants asset generation, follow these steps:' : 'Generate the following assets:'}

        1. Generate the following assets for this business's Google Ads campaign:
        ${assetPrompts}

        2. Format your response with:
           - First, a brief introduction (1-2 sentences) ${!isRefreshMode ? `using this template: "${responseTemplate}"` : ''}
           - Then, a JSON code block with the structured data

        ${refreshSection}

        ${rulesSection}

        # Business Context
        Idea: ${state.brainstorm.idea}
        Target Audience: ${state.brainstorm.audience}
        Solution: ${state.brainstorm.solution}
        Social Proof: ${state.brainstorm.socialProof}

        ${previousAssetsContext}

        ${outputPrompt}
    `.replace(/\n\s*\n/g, '\n\n').trim();
}
