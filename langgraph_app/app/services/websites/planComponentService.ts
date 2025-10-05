import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLlm, LLMSkill, defaultCachePolicy, withInfrastructure, type NotificationOptions } from "@core";
import { type CodeTaskType, getComponentPlanSchema, type ComponentContentPlanType, Task } from "@types";
import { planComponentPrompt, type PlanComponentProps } from "@prompts";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { ComponentOverviewModel, ComponentContentPlanModel } from "@models";

export { type PlanComponentProps }

export type PlanComponentOutputType = {
    contentPlan: ComponentContentPlanType
}

const notificationContext: NotificationOptions = {
    taskName: async (task: CodeTaskType) => {
      if (!task.componentOverviewId) {
        return "Planning next section";
      }
      const overview = await ComponentOverviewModel.find(task.componentOverviewId);
      if (!overview.name) {
        return "Planning next section";
      }
      return `Writing content for ${overview.name}`;
    },
    taskType: Task.TypeEnum.CodeTask,
};

export class PlanComponentService {
    @withInfrastructure({
        cache: {
            prefix: "planComponent",
            ...defaultCachePolicy
        },
        notifications: notificationContext,
    })
    async execute(input: PlanComponentProps, config?: LangGraphRunnableConfig): Promise<PlanComponentOutputType> {
        const task = input.task;
        const componentOverview = input.componentOverview;
        
        // Get the appropriate content schema based on component type
        const contentSchema = getComponentPlanSchema(componentOverview);
        const llm = getLlm(LLMSkill.Planning);
        const prompt = await planComponentPrompt({
            ...input,
            componentOverview,
        });
        
        const agentState = {
            messages: [new HumanMessage("Help the user plan a section of their website.")]
        };

        // TODO: Initialize search icons tool when available
        // const { searchIcons } = await initializeSearchIcons(agentState);
        const tools: any[] = [];
        
        const agent = createReactAgent({
            llm,
            tools,
            prompt,
            responseFormat: contentSchema,
        });

        const agentOutput = await agent.invoke(agentState);

        const contentPlan = agentOutput.structuredResponse;

        const contentPlanType = await ComponentContentPlanModel.create({
            componentOverviewId: task.componentOverviewId,
            componentType: componentOverview.componentType,
            data: contentPlan,
        })

        return {}
    }
}
