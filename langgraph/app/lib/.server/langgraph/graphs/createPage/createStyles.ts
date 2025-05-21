import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphAnnotation } from "@state/graph";
import { createStylesNode } from "@nodes/createPage/createStyles";

export const createStylesGraph = new StateGraph(GraphAnnotation)
    .addNode("createStyles", createStylesNode)

    .addEdge(START, "createStyles")
    .addEdge("createStyles", END)

export const graph = createStylesGraph.compile(); 