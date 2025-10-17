import { StateGraph, END, START } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { type BrainstormGraphState } from "@state";
import { graphParams } from "@core";
import { askQuestionNode, brainstormGuardrailNode, addImplicitFirstQuestionNode } from "@nodes";

export const brainstormGraph = new StateGraph(BrainstormAnnotation)
    .addNode("addImplicitFirstQuestion", addImplicitFirstQuestionNode)
    .addNode("brainstormGuardrail", brainstormGuardrailNode)
    .addNode("askQuestion", askQuestionNode)

    .addEdge(START, "addImplicitFirstQuestion")
    .addEdge("addImplicitFirstQuestion", "brainstormGuardrail")
    .addEdge("brainstormGuardrail", "askQuestion")
    .addEdge("askQuestion", END)
    .compile(graphParams)