import { StateGraph, START, END } from "@langchain/langgraph";
import { nameProjectNode } from "@nodes/core/nameProject";
import { GraphAnnotation } from "@state/graph";

export const nameProjectGraph = new StateGraph(GraphAnnotation)
    .addNode("nameProject", nameProjectNode)
    .addEdge(START, "nameProject")
    .addEdge("nameProject", END)

export const graph = nameProjectGraph.compile(); 