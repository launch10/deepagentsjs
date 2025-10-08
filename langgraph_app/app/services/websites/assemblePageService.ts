import { 
    type NotificationOptions,
    getLlm, 
    LLMSkill, 
    defaultCachePolicy, 
    withInfrastructure,
    fileSpecRegistry
} from "@core";
import { CodeTask, Task, type CodeTaskType, type TaskType } from "@types";
import { assemblePagePrompt, type AssemblePageProps } from "@prompts";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { PageTypeEnum } from "@types";
import { CreateFilesAndTasksService } from "@services";

export { type AssemblePageProps }

export type AssemblePageOutputType = {
    completedTasks: CodeTaskType[],
}

const notificationContext: NotificationOptions = {
    taskName: `Putting it all together`,
    taskType: Task.TypeEnum.CodeTask,
};
export class AssemblePageService {
    @withInfrastructure({
        cache: {
            prefix: "assemblePage",
            ...defaultCachePolicy
        },
        notifications: notificationContext,
    })
    async execute(input: AssemblePageProps, config?: LangGraphRunnableConfig): Promise<AssemblePageOutputType> {
        const llm = getLlm(LLMSkill.Coding);
        const coderLlm = llm.withStructuredOutput(CodeTask.resultSchema);
        const prompt = await assemblePagePrompt(input);
        console.log(prompt)
        const taskResults = await coderLlm.invoke(prompt);
        const fileSpec = fileSpecRegistry.get(PageTypeEnum.IndexPage);

        if (!fileSpec) {
            throw new Error("IndexPage file specification not found");
        }

        const websiteId = input.website?.id;
        const projectId = input.website?.projectId;

        if (!websiteId || !projectId) {
            throw new Error("Website ID or Project ID is missing");
        }

        const task: CodeTaskType = {
            title: "Update IndexPage",
            subtype: CodeTask.SubtypeEnum.CREATE_PAGE,
            type: Task.TypeEnum.CodeTask,
            action: Task.ActionEnum.UPDATE,
            status: Task.StatusEnum.COMPLETED,
            results: taskResults,
            fileSpecificationId: fileSpec.id,
            componentType: PageTypeEnum.IndexPage,
            websiteId: websiteId,
            projectId: projectId,
        }

        const websiteFile = {
            websiteId: websiteId,
            fileSpecificationId: fileSpec.id,
            path: fileSpec.canonicalPath,
            content: taskResults.code || ''
        };

        const createFilesAndTasks = new CreateFilesAndTasksService();
        return await createFilesAndTasks.execute({
            tasks: [task],
            websiteFiles: [websiteFile]
        });
    }
}
