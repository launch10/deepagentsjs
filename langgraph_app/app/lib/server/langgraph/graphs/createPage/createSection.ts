import { StateGraph, START, END } from "@langchain/langgraph";
import { setupNode } from "~/lib/server/langgraph/nodes/createPage/createSection/setup";
import { GraphAnnotation } from "@state/graph";
import { planCreateSectionNode, createSectionNode } from "~/lib/server/langgraph/nodes/createPage/createSection";
import { graphParams } from "@graphs/params";

export const createSectionGraph = new StateGraph(GraphAnnotation)
    .addNode("startCreateSection", setupNode)
    .addNode("planCreateSection", planCreateSectionNode, {
        cachePolicy: {
            ttl: process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL) : 60 * 60 * 24 // 24 hours
        }
    })
    .addNode("createSection", createSectionNode, {
        cachePolicy: {
            ttl: process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL) : 60 * 60 * 24 // 24 hours
        }
    })

    .addEdge(START, "startCreateSection")
    .addEdge("startCreateSection", "planCreateSection")
    .addEdge("planCreateSection", "createSection")
    .addEdge("createSection", END)

export const graph = createSectionGraph.compile(graphParams);