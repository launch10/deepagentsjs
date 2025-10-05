import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphAnnotation } from "@annotation";
import { planComponentNode, createComponentNode } from "@nodes";
import { graphParams } from "@core";

export const createComponentGraph = new StateGraph(GraphAnnotation)
    .addNode("planComponent", planComponentNode)
    .addNode("createComponent", createComponentNode)

    .addEdge(START, "planComponent")
    .addEdge("planComponent", "createComponent")
    .addEdge("createComponent", END)
    .compile(graphParams)