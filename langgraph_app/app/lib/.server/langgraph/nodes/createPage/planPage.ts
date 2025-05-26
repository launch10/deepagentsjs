import { getLlm, LLMSkill } from "@langgraph/llm";
import { pagePlanSchema } from "@models/page";
import { planPagePrompt } from "@prompts/createPage/planPage";
import { v4 as uuidv4 } from 'uuid';
import type { GraphState } from "@shared/state/graph";
import { baseNode } from "../core/templates/base";
import { type CodeTask, CodeTaskType, TaskStatus } from "@models/codeTask";
import { fileSpecRegistry } from "@models/registry/fileSpecificationRegistry";
import { FileTypeEnum } from "@models/enums";
import { getSectionTheme, type SectionTheme } from "@models/section";

/**
 * Assign section content from the content strategy to each section, so during section creation,
 * the content is already assigned.
 */
export async function planPage(state: GraphState): Promise<Partial<GraphState>> {
    const promptContent = await planPagePrompt(state);

    const llm = getLlm(LLMSkill.Planning);
    const sectionOverviewSchema = pagePlanSchema.pick({ sections: true, description: true });
    const planner = llm.withStructuredOutput(sectionOverviewSchema);
    const pagePlan = await planner.invoke(promptContent);

    const { page } = state.app;
    page.plan = pagePlan;
    pagePlan.name = page.name;
    pagePlan.subtype = page.name;

    const codeTasks: CodeTask[] = pagePlan.sections.map((sectionOverview) => {
        const fileSpec = fileSpecRegistry.getByType(FileTypeEnum.Section, sectionOverview.sectionType);
        if (!fileSpec) {
            throw new Error(`File specification not found for section: ${sectionOverview.sectionType}`);
        } 
        const expectedPath = `src/components/${sectionOverview.componentId}.tsx`;
        const theme: SectionTheme = getSectionTheme(sectionOverview.backgroundColor);
        const codeTask: CodeTask = {
            id: uuidv4(),
            type: CodeTaskType.CREATE_SECTION,
            status: TaskStatus.PENDING,
            section: {
                sectionType: sectionOverview.sectionType,
                filePath: expectedPath,
                contentPlan: {
                    overview: sectionOverview
                },
                theme: theme,
            },
            filePath: expectedPath,
            fileSpec: fileSpec,
            instruction: "Create this section",
            contentPlan: {
                overview: sectionOverview
            }
        }
        return codeTask;
    });

    return {
        app: {
            page: page,
            codeTasks: {
                queue: codeTasks
            }
        }
    };
}

export const planPageNode = baseNode({
    nodeName: "planPageNode",
    nodeFn: planPage,
});
