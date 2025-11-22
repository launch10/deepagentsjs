import { type CodeTaskType, Task, CodeTask, StyleTypeEnum, type ThemeType } from "@types";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { CodeTaskModel } from "@models";
import { TemplateFileModel, TemplateModel } from "@models";
import { IndexCssService, CreateFilesAndTasksService } from "@services";
import { FileSpecificationModel } from "@models";
import { keyBy } from "@utils";

export type CreateStylesOutputType = {
    completedTasks: CodeTaskType[];
}
interface CreateStylesProps {
    theme: ThemeType;
    websiteId: number;
    projectId: number;
}

const styleFiles = [StyleTypeEnum.IndexCss, StyleTypeEnum.TailwindConfig];

// Take the selected theme, and generate the appropriate index.css + 
// tailwind.config.ts files based on the theme variables.
export class CreateStylesService {
    async execute(input: CreateStylesProps, config?: LangGraphRunnableConfig): Promise<CreateStylesOutputType> {
        const theme = input.theme;
        const websiteId = input.websiteId;
        const projectId = input.projectId;

        // TODO: These are implicitly all for "Template ID = 1". If we ever decide to support multiple templates, 
        // where we don't always consider "index.css" + "tailwind.config.ts" the intended way to manage styles,
        // we'll need to handle that.
        let fileSpecs = await FileSpecificationModel.where({ componentType: styleFiles })
        const order = [StyleTypeEnum.IndexCss, StyleTypeEnum.TailwindConfig];
        fileSpecs = fileSpecs.sort((a, b) => order.indexOf(a.componentType) - order.indexOf(b.componentType))
        const fileSpecsById = keyBy(fileSpecs, 'id');

        const createStylesTasks = await Promise.all(
            fileSpecs.map(async (spec) => {
                let task: CodeTaskType;
                let code = "";

                if (spec.componentType === StyleTypeEnum.IndexCss && theme.theme) {
                    // Generate the CSS content directly for index.css
                    const service = new IndexCssService();
                    code = await service.execute({ templateId: 1, filePath: spec.canonicalPath, theme });
                } else if (spec.componentType === StyleTypeEnum.TailwindConfig) {
                    const templateFile = await TemplateFileModel.findBy({ templateId: 1, path: spec.canonicalPath });
                    code = templateFile.content;
                }
                return {
                    action: Task.ActionEnum.CREATE,
                    type: Task.TypeEnum.CodeTask,
                    subtype: CodeTask.SubtypeEnum.CREATE_COMPONENT,
                    status: Task.StatusEnum.COMPLETED,
                    componentType: spec.componentType,
                    fileSpecificationId: spec.id,
                    websiteId: websiteId,
                    projectId: projectId,
                    results: { code: code, dependencies: [], summary: `Created ${spec.componentType} file` },
                };
            })
        );
        const websiteFiles = createStylesTasks.map((task) => {
            const fileSpec = fileSpecsById[task.fileSpecificationId]; 
            return {
                websiteId: input.websiteId!,
                fileSpecificationId: task.fileSpecificationId,
                path: fileSpec.canonicalPath,
                content: task.results.code!
            };
        });

        const createFilesAndTasks = new CreateFilesAndTasksService();
        return await createFilesAndTasks.execute({
            tasks: createStylesTasks,
            websiteFiles: websiteFiles
        })
    }
}