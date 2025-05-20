import { z } from "zod";
import type { GraphState } from "@shared/state/graph";
import { type CodeTask, CodeTaskType, TaskStatus } from "@models/codeTask";
import { baseNode } from "@nodes/core/templates/base";
import { v4 as uuidv4 } from "uuid";
import { Template } from "@langgraph/models/template";
import { FileSpecification } from "@models/fileSpecification";
import { StyleTypeEnum } from "@models/enums";
import { PromptTemplate } from "@langchain/core/prompts";
import { getLlm, LLMSkill, LLMSpeed } from "@langgraph/llm";
import { ThemeSearchService, type ThemeResult } from "@services/theme/search";
import { IndexCssService } from "@services/styles/indexCssService";

const schema = z.object({
    themeLabel: z.string().describe("A label describing the color theme, chosen from the available list of labels"),
});

const basePrompt = PromptTemplate.fromTemplate(`
    Based on the provided user request, choose a color theme for the landing page based on the available list of labels:

    <user-request>
    {userRequest}
    </user-request>

    <available-labels>
    {availableLabels}
    </available-labels>

    Expected output: 
    One of the available labels
`);

/**
 * Node to brainstorm overall landing page copy using an LLM.
 * Will eventually support Human in the loop
 */
async function getTheme(state: GraphState): Promise<ThemeResult> {
    if (!state.userRequest) {
        throw new Error("User request is missing from state.");
    }
    const themeService = new ThemeSearchService();
    const availableLabels = await themeService.getAllThemeLabels();

    const llm = getLlm(LLMSkill.Planning, LLMSpeed.Fast);
    const structuredLlm = llm.withStructuredOutput(schema);
    const prompt = await basePrompt.format({ userRequest: state.userRequest.content as string, availableLabels: availableLabels });
    const response = await structuredLlm.invoke(prompt);
    const theme = await themeService.searchThemesByLabels([response.themeLabel], 1);

    if (theme.length === 0) {
        throw new Error("No theme found for label: " + response.themeLabel);
    }
    return theme[0];
}

export async function createStyles(
    state: GraphState
): Promise<Partial<GraphState>> {
    const template = await Template.getTemplate('default');
    const styleSpecs = (template.styles || []) as FileSpecification[];
    const order = [StyleTypeEnum.IndexCss, StyleTypeEnum.TailwindConfig];
    const theme = await getTheme(state);

    // Use Promise.all to handle async generation within map
    const createStylesTasks = await Promise.all(
        styleSpecs.sort((a, b) => order.indexOf(a.subtype) - order.indexOf(b.subtype)).map(async (spec) => {
            let task: CodeTask;
            let code = "";

            if (spec.subtype === StyleTypeEnum.IndexCss && theme.theme) {
                // Generate the CSS content directly for index.css
                console.log(`Generating index.css content using theme from theme: ${theme.name}`);
                const service = new IndexCssService(theme.theme, 'default', spec.canonicalPath);
                code = await service.generate();
            } else if (spec.subtype === StyleTypeEnum.TailwindConfig) {
                const template = await Template.getTemplate('default');
                code = template.files["tailwind.config.ts"].content;
            }
            task = {
                    id: uuidv4(),
                    type: CodeTaskType.UPDATE,
                    status: TaskStatus.COMPLETED,
                    filePath: spec.canonicalPath,
                    fileSpec: spec,
                    success: true,
                    results: { code: code }
                };
            return task;
        })
    );

    return {
        app: {
            ...state.app,
            project: {
                ...state.app.project,
                themeId: theme.id,
                projectPlan: {
                    ...state.app.project.projectPlan,
                    theme: theme.theme
                }
            },
            codeTasks: {
                ...state.codeTasks,
                completedTasks: [...createStylesTasks]
            }
        }
    };
}

export const createStylesNode = baseNode({
    nodeName: "createStyles",
    nodeFn: createStyles
});