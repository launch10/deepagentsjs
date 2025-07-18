import { StateGraph, END, START } from "@langchain/langgraph";
import { GraphAnnotation } from "@state/graph";
import { type GraphState } from "@shared/state/graph";
import { graphParams } from "./params";

const bloopNode = async(state: GraphState): Promise<Partial<GraphState>> => {
    return {
        app: {
            project: {
                projectName: "Bloop",
            },
            codeTasks: {
                queue: [],
                completedTasks: [{ id: "bloop", type: "bloop", status: "bloop", filePath: "bloop", instruction: "bloop", plan: { type: "bloop", filePath: "bloop", userPrompt: "bloop", instruction: "bloop" }, success: true }],
            }
        }
    }
}

const subgraph = new StateGraph(GraphAnnotation)
    .addNode("bloopNode", bloopNode)
    .addEdge(START, "bloopNode")
    .addEdge("bloopNode", END)
    .compile(graphParams)

export const routerGraph = new StateGraph(GraphAnnotation)
    .addNode("bloopSubgraph", subgraph)
    .addEdge(START, "bloopSubgraph")
    .addEdge("bloopSubgraph", END)

export const graph = routerGraph.compile(graphParams)
