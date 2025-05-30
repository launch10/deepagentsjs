import { type GraphState } from "@shared/state/graph";
import { projectPlanSchema, type ProjectPlan } from "@models/project/projectPlan";
import { projectPlanPrompt } from "@prompts/create";
import { getLlm, LLMSkill } from "@langgraph/llm";
import { baseNode } from "@nodes/core/templates/base";
import { PageTypeEnum } from "@models/enums";
import { fileSpecRegistry } from "@models/registry/fileSpecificationRegistry";
import { FileTypeEnum } from "@models/enums";

/**
 * Node to brainstorm overall landing page copy using an LLM.
 * Will eventually support Human in the loop
 */
async function projectPlan(state: GraphState): Promise<Partial<GraphState>> {
    if (!state.userRequest) {
        throw new Error("User request is missing from state.");
    }

    const { project } = state.app;

    const llm = getLlm(LLMSkill.Writing);
    const structuredLlm = llm.withStructuredOutput(projectPlanSchema.omit({ theme: true }));
    const prompt = projectPlanPrompt(state.userRequest.content as string);
    const response = await structuredLlm.invoke(prompt);
    const projectPlan = response as ProjectPlan;
    // project.projectName = projectPlan.projectName as string;
    projectPlan.projectName = state.projectName;
    project.projectPlan = projectPlan;

    const pageSpec = fileSpecRegistry.getByType(FileTypeEnum.Page, PageTypeEnum.IndexPage);
    if (!pageSpec) {
        throw new Error("Page specification not found for IndexPage.");
    }

    return {
        app: {
            ...state.app,
            project,
            page: {
                subtype: PageTypeEnum.IndexPage,
                filePath: pageSpec.canonicalPath,
            }
        }
    };
}

export const projectPlanNode = baseNode({
    nodeName: "projectPlanNode",
    nodeFn: projectPlan,
    buildTaskTitle: (state: GraphState, config: LangGraphRunnableConfig) => {
        return {
            title: "Brainstorming overall project",
        };
    }
});