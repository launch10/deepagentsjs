import { StateGraph, END, START } from "@langchain/langgraph";
import { GraphAnnotation } from "@state/graph";
import { type GraphState } from "@shared/state/graph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { graph as createGraph } from "@graphs/create";
import { graph as updateGraph } from "@graphs/update";
import { graph as nameProjectGraph } from "@graphs/core/nameProject";

const addMessage = async(state: GraphState): Promise<Partial<GraphState>> => {
    return {
        messages: [...state.messages, state.userRequest]
    };
}

const router = async(state: GraphState): Promise<string> => {
    const projectName = state.projectName;
    const isFirstMessage = (projectName === undefined);

    if (isFirstMessage) {
        return "nameProject";
    }
    return "update";
}

export const routerGraph = new StateGraph(GraphAnnotation)
    .addNode("addMessage", addMessage)
    .addNode("nameProject", nameProjectGraph)
    .addNode("create", createGraph)
    .addNode("update", updateGraph)

    .addEdge(START, "addMessage")
    .addConditionalEdges("addMessage", router, {
        "nameProject": "nameProject",
        "update": "update"
    })
    .addEdge("nameProject", "create")
    .addEdge("create", END)
    .addEdge("update", END)

// export const checkpointer = PostgresSaver.fromConnString(process.env.POSTGRES_URI!);
// await checkpointer.setup();
export const graph = routerGraph.compile();
