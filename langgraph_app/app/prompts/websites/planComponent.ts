import { 
  projectSummaryPrompt, 
  brandGuidelinesPrompt, 
  componentOverviewPrompt, 
  availableShadCnComponentsPrompt,
  structuredOutputPrompt,
  useKnownAssetsPrompt,
  renderPrompt,
} from "@prompts";
import { planComponentInstructionsPrompt } from "./planComponent/instructions/planComponentInstructions";

import { Website, CodeTask, ComponentTypeEnum, type ComponentOverviewType } from "@types";
import type { BaseMessage } from '@langchain/core/messages';
import { lastHumanMessage } from "@types";
import { ContentStrategyModel, FileSpecificationModel } from "@models";
import { schemaRegistry } from "@types";
export interface PlanComponentProps {
  task: CodeTask.CodeTaskType;
  componentOverview: ComponentOverviewType;
  website: Website.WebsiteType;
  messages: BaseMessage[];
}

export const planComponentPrompt = async ({ 
    task,
    componentOverview,
    website,
    messages,
  }: PlanComponentProps): Promise<string> => {
    if (!website) {
        throw new Error('website is required');
    }
    if (!task) {
        throw new Error('task is required');
    }
    if (!messages) {
        throw new Error('messages is required');
    }
    const contentStrategy = await ContentStrategyModel.findBy({ websiteId: website.id });
    if (!contentStrategy) {
        throw new Error('contentStrategy is required');
    }
    const summary = contentStrategy.summary;
    if (!summary) {
        throw new Error('website summary is required');
    }
    if (!task.fileSpecificationId) {
        throw new Error('fileSpecificationId is required');
    }
    const fileSpec = await FileSpecificationModel.find(task.fileSpecificationId);
    if (!fileSpec) {
        throw new Error('fileSpec is required');
    }
    if (!componentOverview) {
        throw new Error('componentOverview is required');
    }
    const componentType = fileSpec.componentType;
    if (!componentType) {
        throw new Error('componentType is required');
    }
    const copy = componentOverview.copy || 'No copy provided'

    const userRequest = lastHumanMessage({messages});
    if (!userRequest) {
        throw new Error('userRequest is required');
    }

    const componentSchema = schemaRegistry[fileSpec.componentType as ComponentTypeEnum].schema;
    if (!componentSchema) {
        throw new Error('componentSchema is required');
    }

    const [projectSummaryStr, brandGuidelinesStr, componentOverviewStr, planInstructions, availableComponentsStr, useKnownAssetsStr, structuredOutputStr] = await Promise.all([
        projectSummaryPrompt({ summary }),
        brandGuidelinesPrompt({ contentStrategy }),
        componentOverviewPrompt({ overview: componentOverview }),
        planComponentInstructionsPrompt({ componentType: fileSpec.componentType, websiteId: website.id! }),
        availableShadCnComponentsPrompt(),
        useKnownAssetsPrompt(),
        structuredOutputPrompt({ schema: componentSchema })
    ]);

    return renderPrompt(`
        <role>
            You are a Section Planner Agent. Your task is to take a high-level overview of a single section of a landing page and expand it into a comprehensive, detailed plan.
            This detailed plan will be used by another AI (The Code Generator) to implement the section's code.
            Focus on providing clear, actionable details covering content, layout, visuals, and interactivity based on the section's goal and overall brand guidelines.
            The end goal is to create an incredible, high-converting landing page, so ensure that the plan is both effective and engaging, and easy for the code writer agent to implement.
        </role>

        <task>
            Generate the detailed plan for the section based on the provided information.
            Follow the specific instructions provided for the given section type.
        </task>

        ${projectSummaryStr}
        ${brandGuidelinesStr}
        ${componentOverviewStr}

        <copy>
            ${copy}
        </copy>

        ${planInstructions}
        ${availableComponentsStr}

        <important>
            ${useKnownAssetsStr}
        </important>

        <user-request>
            ${userRequest.content}
        </user-request>

        <task>
            REMINDER: 
            Generate the detailed plan for the section based on the provided information.
            Follow the specific instructions provided for the given section type.
        </task>

        ${structuredOutputStr}
    `);
};

planComponentPrompt.promptMetadata = {
    name: 'Plan Component',
    category: 'Code Generation',
    description: 'Plans a React component with design guidelines',
    examples: []
} as PromptMetadata;
