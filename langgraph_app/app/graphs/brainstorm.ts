import { StateGraph, END, START } from "@langchain/langgraph";
import { GraphAnnotation } from "@annotation";
import { type GraphState } from "@state";
import { createGraph } from "./create";
import { nameProjectNode } from "@nodes";
import { updateGraph } from "./update";
import { graphParams } from "@core";
import { isFirstMessage } from "@annotation";

const router = async(state: GraphState): Promise<string> => {
  return "askQuestion"
}

export const routerGraph = new StateGraph(GraphAnnotation)
    .addNode("router", router)
    .addNode("askQuestion", askQuestionNode)
    // .addNode("update", updateGraph)

    .addEdge(START, "router")
    .addEdge("router", "askQuestion")
    .addEdge("askQuestion", END)
    // .addConditionalEdges(START, router, {
    //     "nameProject": "nameProject",
    //     "update": "update"
    // })
    // .addEdge("nameProject", "create")
    // .addEdge("create", END) 
    // .addEdge("update", END)
    .compile(graphParams)