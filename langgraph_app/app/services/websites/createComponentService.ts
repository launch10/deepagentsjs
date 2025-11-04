import { 
    type NotificationOptions,
    getLLM, 
    withInfrastructure,
} from "@core";
import { 
    type CodeTaskType, 
    type WebsiteType,
    Task, 
    CodeTask,
    type ThemeVariantType,
} from "@types";
import { lastHumanMessage } from "@annotation";
import { createComponentPrompt } from "@prompts";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { 
    ComponentOverviewModel, 
    ComponentContentPlanModel, 
    ContentStrategyModel,
    ThemeVariantModel,
} from "@models";
import { fileSpecRegistry } from "@core";
import { SaveComponentService } from "./saveComponentService";

export type CreateComponentOutputType = {
    task: CodeTaskType,
}

export type CreateComponentProps = {
    website: WebsiteType;
    task: CodeTaskType;
}

const notificationContext: NotificationOptions = {
    taskName: async (task: CodeTaskType) => {
      if (!task.componentOverviewId) {
        return "Planning next section";
      }
      try {
        const overview = await ComponentOverviewModel.find(task.componentOverviewId);
        if (!overview || !overview.name) {
          return "Planning next section";
        }
        return `Writing content for ${overview.name}`;
      } catch (error) {
        console.error('Planning next section failed:', error);
        return "Planning next section";
      }
    },
    taskType: Task.TypeEnum.CodeTask,
};

export class CreateComponentService {
    @withInfrastructure({
        cache: {
            prefix: "createComponent",
        },
        notifications: notificationContext,
    })
    async execute(input: CreateComponentProps, config?: LangGraphRunnableConfig): Promise<CreateComponentOutputType> {
        const contentPlan = await ComponentContentPlanModel.findBy({
            componentOverviewId: input.task.componentOverviewId,
        });
        if (!contentPlan) {
            throw new Error('contentPlan is required');
        }
        const userRequest = lastHumanMessage({ messages: input.messages });
        if (!userRequest) {
            throw new Error('userRequest is required');
        }
        if (!userRequest || !userRequest.content) {
            throw new Error('userRequest is required');
        }
        if (!input.task.componentType) {
            throw new Error('componentType is required');
        }
        const fileSpec = fileSpecRegistry.get(input.task.componentType);
        if (!fileSpec) {
            throw new Error('fileSpec is required');
        }
        const contentStrategy = await ContentStrategyModel.findBy({websiteId: input.website.id});
        if (!contentStrategy) {
            throw new Error('contentStrategy is required');
        }

        const overview = await ComponentOverviewModel.find(contentPlan.componentOverviewId);
        if (!overview) {
            throw new Error('overview is required');
        }
        const bgColor = overview.backgroundColor;
        const themeVariant: ThemeVariantType = await ThemeVariantModel.findBy({ backgroundClass: `--${bgColor}` });
        if (!themeVariant) {
            throw new Error('themeVariant is required');
        } 

        const llm = getLLM("coding");
        const coderLlm = llm.withStructuredOutput(CodeTask.resultSchema);
        const prompt = await createComponentPrompt({
            task: input.task,
            contentStrategy,
            contentPlan,
            themeVariant,
            overview,
            fileSpec,
            userRequest,
        });
        const taskResults = await coderLlm.invoke(prompt);

        const task = {
            ...input.task,
            results: taskResults,
            status: Task.StatusEnum.COMPLETED,
        } as CodeTaskType

        const results = await new SaveComponentService().execute({
            task,
            website: input.website,
            contentPlan,
            componentOverview: overview,
            fileSpec,
            themeVariant,
        })

        return { task: results.task }
    }
}
