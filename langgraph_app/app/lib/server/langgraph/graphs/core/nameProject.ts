import { StateGraph, START, END } from "@langchain/langgraph";
import { nameProjectNode } from "@nodes/core/nameProject";
import { GraphAnnotation } from "@state/graph";
import { graphParams } from "@graphs/params";
import { keyFunc } from "@nodes/core/templates/base";

export const nameProjectGraph = new StateGraph(GraphAnnotation)
    .addNode("nameProject", nameProjectNode, {
        cachePolicy: {
            ttl: process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL) : 60 * 60 * 24, // 24 hours
            keyFunc: keyFunc
        }
    })
    .addEdge(START, "nameProject")
    .addEdge("nameProject", END)

export const graph = nameProjectGraph.compile(graphParams); 