import { StateGraph, END, START } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { type BrainstormGraphState } from "@state";
import { graphParams } from "@core";
import { askQuestionNode, brainstormGuardrailNode } from "@nodes";

const router = async(state: BrainstormGraphState): Promise<string> => {
  return "brainstormGuardrail"
}

export const brainstormGraph = new StateGraph(BrainstormAnnotation)
    .addNode("brainstormGuardrail", brainstormGuardrailNode)
    .addNode("askQuestion", askQuestionNode)

    .addEdge(START, "brainstormGuardrail")
    .addEdge("brainstormGuardrail", "askQuestion")
    .addEdge("askQuestion", END)
    .compile(graphParams)