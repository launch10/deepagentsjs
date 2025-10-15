import { StateGraph, END, START } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { type BrainstormGraphState } from "@state";
import { graphParams } from "@core";
import { askQuestionNode, checkResponseNode } from "@nodes";

const router = async(state: BrainstormGraphState): Promise<string> => {
  return "checkResponse"
}

export const brainstormGraph = new StateGraph(BrainstormAnnotation)
    .addNode("checkResponse", checkResponseNode)
    .addNode("askQuestion", askQuestionNode)

    .addConditionalEdges(START, router, {
        "checkResponse": "checkResponse",
    })
    .addEdge("checkResponse", "askQuestion")
    .addEdge("askQuestion", END)
    .compile(graphParams)