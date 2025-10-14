import { StateGraph, END, START } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { type BrainstormGraphState } from "@state";
import { graphParams } from "@core";
import { askQuestionNode } from "@nodes";

const router = async(state: BrainstormGraphState): Promise<string> => {
  return "askQuestion"
}

export const brainstormGraph = new StateGraph(BrainstormAnnotation)
    .addNode("askQuestion", askQuestionNode)
    // .addNode("update", updateGraph)

    .addConditionalEdges(START, router, {
        "askQuestion": "askQuestion",
    })
    .addEdge("askQuestion", END)
    // .addConditionalEdges(START, router, {
    //     "nameProject": "nameProject",
    //     "update": "update"
    // })
    // .addEdge("nameProject", "create")
    // .addEdge("create", END) 
    // .addEdge("update", END)
    .compile(graphParams)