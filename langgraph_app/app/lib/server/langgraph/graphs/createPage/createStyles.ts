import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphAnnotation } from "@state/graph";
import { createStylesNode } from "@nodes/createPage/createStyles";
import { graphParams } from "@graphs/params";
import { keyFunc } from "@nodes/core/templates/base";

export const createStylesGraph = new StateGraph(GraphAnnotation)
    .addNode("createStyles", createStylesNode, {
        cachePolicy: {
            ttl: process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL) : 60 * 60 * 24, // 24 hours
            keyFunc: keyFunc
        }
    })

    .addEdge(START, "createStyles")
    .addEdge("createStyles", END)

export const graph = createStylesGraph.compile(graphParams); 