import { type LangGraphRunnableConfig, Ads, isHumanMessage } from "@types";
import { type AdsGraphState } from "@state";
import { getAssetPrompts, getOutputPrompt } from "./assets/index";
import { needsIntentClassification } from "./helpers";
import { ResponseTemplates } from "./assets/responseTemplates";
import { previousAssetsContext } from "./helpers/previousAssetsContext";
import { processPrompt } from "../../core/process";
import { whereWeArePrompt, whatTheUserIsSeeingPrompt } from "./whereWeAre";
import { helpInstructions } from "../helpPrompt";
import { HumanMessage } from "@langchain/core/messages";
import { isPseudoMessage } from "../pseudoMessages";

const isRealHumanMessage = (state: AdsGraphState): boolean => {
  const lastMessage = state.messages?.at(-1);
  return !!lastMessage && HumanMessage.isInstance(lastMessage) && !isPseudoMessage(lastMessage);
};

const buildPreviousAssetsContext = (state: AdsGraphState): string => {
  const sections = previousAssetsContext(state);

  if (!sections.length) return "";

  return `
    <previous_assets_context>
        The user has already reviewed some assets. Use their preferences to guide new generations:
        ${sections.join("\n\n")}

        Generate new assets that complement the approved ones and avoid themes similar to rejected ones.
    </previous_assets_context>`;
};

const buildIntentSection = (state: AdsGraphState): string => {
  const needsIntent = needsIntentClassification(state);

  if (!needsIntent) return "";

  return `
        <intent_classification>
            First, determine the user's intent from their message:
            
            1. **Asset Generation (Happy Path)**: The user wants help creating ad assets (headlines, descriptions, etc.)
                - Examples: "Help me write headlines", "Generate some descriptions", "Let's get started", "Begin", "Refresh suggestions"
                - For this path: Generate assets AND include structured JSON data
            
            2. **Questions/FAQ (Help Path)**: The user is asking questions about how Google Ads work, seeking clarification, or needs help understanding something
                - Examples: "How do headlines and descriptions pair together?", "What's the character limit?", "Why do I need multiple headlines?"
                - For this path: Use the faq tool to get context, then answer conversationally. Do NOT include any JSON data.
        </intent_classification>
    `;
};

const buildRefreshSection = (state: AdsGraphState): string => {
  if (!state.refresh?.length) return "";

  const assetDescriptions = state.refresh
    .map((r) => `${r.nVariants} NEW ${r.asset}`)
    .join(" and ");

  return `
        <refresh_mode>
            The user clicked the refresh button. 

            Generate exactly ${assetDescriptions}.

            DO NOT summarize, explain, or ask questions - just generate the assets with a brief intro and the JSON block.

            Ignore any previous conversation context - this is a fresh generation request.
        </refresh_mode>`;
};

const buildHelpSection = (state: AdsGraphState, config: LangGraphRunnableConfig): string => {
  const needsIntent = needsIntentClassification(state);

  if (!needsIntent) return "";

  return `
        If the user is asking asking questions, as opposed to requesting new assets, you should follow these instructions:

        ${helpInstructions(state, config)}
    `;
};

const buildRulesSection = (state: AdsGraphState): string => {
  const needsIntent = needsIntentClassification(state);
  if (!needsIntent) return "";

  return `
        <important_rules>
            - NEVER mix the two paths. Either provide structured JSON (happy path) OR plain text answers (help path)
            - For the happy path, ALWAYS include the introductory text BEFORE the JSON block
            - For the help path, NEVER include JSON - only conversational text
            - When providing FAQ answers, keep responses brief and focused (2-3 sentences MAX)
        </important_rules>
    `;
};

export const promptBuilder = async (state: AdsGraphState, config: LangGraphRunnableConfig) => {
  if (!state.stage) {
    throw new Error("Project is required");
  }
  if (!state.brainstorm) {
    throw new Error("Brainstorm is required");
  }

  const [process, whereWeAre, assetPrompts, outputPrompt] = await Promise.all([
    processPrompt(state, config),
    whereWeArePrompt(state, config),
    getAssetPrompts(state, config),
    getOutputPrompt(state, config),
  ]);
  const responseTemplate = ResponseTemplates[state.stage];
  const isRefreshMode = !!state.refresh?.length;
  const humanAskedQuestion = isRealHumanMessage(state);
  let messageInstruction;
  if (humanAskedQuestion){
    messageInstruction = `- First, reply to the user's message. Always include a brief 1-2 sentences before the JSON block.`;
  } else if (isRefreshMode) {
    messageInstruction = `- Just output structured JSON data, no text.`;
  } else {
    messageInstruction = `- First, a brief introduction (1-2 sentences) using this template: "${responseTemplate}"`;
  }

  const previousAssetsContext = buildPreviousAssetsContext(state);
  const refreshSection = buildRefreshSection(state);
  const helpSection = buildHelpSection(state, config);
  const rulesSection = buildRulesSection(state);
  const intentClassificationSection = buildIntentSection(state);

  return `
        ${process}

        ${whereWeAre}

        <role>
            You are an expert Google Ads copywriter helping to create compelling ad extensions for a business.
        </role>

        ${intentClassificationSection}

        ${helpSection}

        <asset_generation_instructions>
            ${needsIntentClassification(state) ? "If the user wants asset generation, follow these steps:" : "Generate the following assets:"}

                1. Generate the following assets for this business's Google Ads campaign:
                ${assetPrompts}

                2. Format your response with:
                    ${messageInstruction}
                    - Then, a JSON code block with the structured data
        </asset_generation_instructions>

        ${refreshSection}

        ${rulesSection}

        <business_context>
            Idea: ${state.brainstorm.idea}

            Target Audience: ${state.brainstorm.audience}

            Solution: ${state.brainstorm.solution}

            Social Proof: ${state.brainstorm.socialProof}
        </business_context>

        ${previousAssetsContext}

        <remember>
          Remember: Pay attention to which page the user is on. 
          What are they seeing? This is the most important context for their question.
          These are the assets they are likely asking about.
        </remember>

        ${whatTheUserIsSeeingPrompt(state, config)}

        ${outputPrompt}
    `
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
};
