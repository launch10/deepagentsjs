import { type GraphState } from "@shared/state/graph";
import { graph as nameProjectGraph } from "~/lib/.server/langgraph/graphs/core/nameProject";

type NameProjectInput = Pick<GraphState, 'userRequest' | 'messages' | 'projectName'>;
type NameProjectOutput = Pick<GraphState, 'projectName'>;

export const nameProject = async(state: NameProjectInput): Promise<NameProjectOutput> => {
    const finalState = await nameProjectGraph.invoke(state as Partial<GraphState>);

    if (typeof finalState.projectName !== 'string' || !finalState.projectName) {
        throw new Error("Name project graph failed to return a valid project name.");
    }

    return { projectName: finalState.projectName };
}