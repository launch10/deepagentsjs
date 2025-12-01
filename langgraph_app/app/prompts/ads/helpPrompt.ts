import { type LangGraphRunnableConfig } from "@types";
import { type AdsGraphState } from "@state";
import { processPrompt } from "../core/process";
import { whereWeArePrompt } from "./assets/whereWeAre";

export const helpInstructions = (state: AdsGraphState, config: LangGraphRunnableConfig) => {
    return `
        <help_instructions>
            1. Use the faq tool to retrieve FAQ context
            2. Answer their question in 2-3 sentences maximum
            3. Do NOT include any JSON or structured data
            4. Keep your answer brief and helpful
        </help_instructions>
    `;
}

export const helpPrompt = async (state: AdsGraphState, config: LangGraphRunnableConfig) => {

    const [process, whereWeAre, instructions] = await Promise.all([
        processPrompt(state, config),
        whereWeArePrompt(state, config),
        helpInstructions(state, config),
    ]);

    return `
        ${process}

        ${whereWeAre}

        Now, the user is asking a question about the ad campaign or process.

        ${instructions}

        <output>
            Output 2-3 sentences maximum, answering the user's question.
        </output>
    `
}