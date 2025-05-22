import { tool, Tool } from "@langchain/core/tools";
import type { GraphState } from "../@shared/state/graph";
import { type ContentStrategy } from "@models/project/projectPlan";

export async function initializeTools(state: GraphState): Promise<{ getContentStrategy: Tool }> {
    const contentStrategy = state.app.project?.projectPlan?.contentStrategy as ContentStrategy;

    async function getContentStrategy(): Promise<{contentStrategy: ContentStrategy}> {
        return { contentStrategy };
    }

    const getContentStrategyTool = tool(getContentStrategy, {
        name: "getContentStrategy",
        description: "Returns the content strategy for the project, useful for generating new copy.",
    });

    return {
        getContentStrategy: getContentStrategyTool
    };
}