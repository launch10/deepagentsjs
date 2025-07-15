import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphAnnotation } from "@state/graph";
import { createStylesNode } from "@nodes/createPage/createStyles";
import { graphParams } from "@graphs/params";
import { cachePolicy } from "@nodes/core/templates/base";

export const createStylesGraph = new StateGraph(GraphAnnotation)
    .addNode("createStyles", createStylesNode, { cachePolicy })

    .addEdge(START, "createStyles")
    .addEdge("createStyles", END)

export const graph = createStylesGraph.compile(graphParams); 