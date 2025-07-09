import { GraphAnnotation } from "@state/graph";
import { type GraphState } from "@shared/state/graph";
import { type StateGraph, type CompiledStateGraph } from "@langchain/langgraph";
import { graph as nameProjectGraph } from "~/lib/server/langgraph/graphs/core/nameProject";
import { nameProject } from "@services/nameProject";
import { graph as createGraph } from "@graphs/create";
import { graph as updateGraph } from "@graphs/update";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";

type RouterOutput = { state: GraphState,
                      config: LangGraphRunnableConfig,
                      graph: CompiledStateGraph<typeof GraphAnnotation.State>
                    };

export const router = async(state: GraphState): Promise<RouterOutput> => {
    let projectName = state.projectName;
    const isFirstMessage = projectName === undefined;

    if (isFirstMessage) {
        projectName = (await nameProject(state)).projectName;
    } else {
        projectName = state.projectName;
    }

    if (typeof projectName !== 'string' || !projectName) {
        throw new Error("Name project graph failed to return a valid project name.");
    }

    const graph: CompiledStateGraph<typeof GraphAnnotation.State> = isFirstMessage ? createGraph : updateGraph;
    // Need to get this from session cookie or some reliable source in the future, don't just blindly trust
    const threadId = `user-${state.tenantId}-${projectName}`;

    const config = { configurable: { thread_id: threadId } };
    return { 
        state: {
            ...state,
            projectName,
            isFirstMessage
        },
        config,
        graph
    }
}