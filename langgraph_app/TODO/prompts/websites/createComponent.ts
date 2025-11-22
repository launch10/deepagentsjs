import { 
    designGuidelinesPrompt, 
    createComponentInstructionsPrompt,
    componentPlanPrompt,
    structuredOutputPrompt,
    componentThemePrompt,
    toJSON,
    renderPrompt,
} from "@prompts";

import { 
    type CodeTaskType,
    type ComponentContentPlanType,
    type ThemeVariantDataType,
    type ContentStrategyType,
    type ComponentOverviewType,
    type FileSpecType,
    CodeTask, 
} from "@types";
import { type HumanMessage } from "@langchain/core/messages";
export interface CreateComponentPromptProps {
    task: CodeTaskType;
    contentStrategy: ContentStrategyType;
    contentPlan: ComponentContentPlanType;
    themeVariant: ThemeVariantType;
    overview: ComponentOverviewType;
    fileSpec: FileSpecType;
    userRequest: HumanMessage;
}

export const createComponentPrompt = async ({ 
    task,
    contentPlan,
    themeVariant,
    overview,
    contentStrategy,
    fileSpec,
    userRequest,
}: CreateComponentPromptProps): Promise<string> => {
    const suggestedComponents = contentPlan.data?.suggestedComponents || [];

    const [codeInstructionsStr, designGuidelinesStr, themeStr, componentPlanStr, structuredOutputStr] = await Promise.all([
        createComponentInstructionsPrompt({task, fileSpec }),
        designGuidelinesPrompt(),
        themeVariant ? componentThemePrompt({themeVariant}) : Promise.resolve(''),
        componentPlanPrompt({ contentPlan, overview }),
        structuredOutputPrompt({schema: CodeTask.resultSchema})
    ]);

    return renderPrompt(`
        <role>
            You are a Code Generation Agent. 
            Your task is to take a detailed plan for a React component 
            and generate the corresponding TSX using Shadcn UI and Tailwind CSS.
            The goal is to create beautiful, responsive, and production-ready code 
            based *strictly* on the provided plan and design guidelines.
        </role>

        <task>
            Generate the React/TSX code for the section detailed below
        </task>

        ${codeInstructionsStr}

        ${designGuidelinesStr}

        ${themeStr}

        <Important>
            This is perhaps THE most important section of the landing page, 
            so make it visually compelling and scannable! 
            This will make or break the user's decision to convert.
        </Important>

        <context>
            <landing-page-summary>
                ${contentStrategy.summary}
            </landing-page-summary>

            <user-request>
                ${userRequest.content}
            </user-request>
        </context>

        <task>
            Generate the React/TSX code for the section detailed below
        </task>

        ${componentPlanStr}

        ${suggestedComponents ? 
            `<suggested-shadcn-components>
                ${toJSON(suggestedComponents)}
            </suggested-shadcn-components>` : ''
        }

        ${structuredOutputStr}
    `);
};