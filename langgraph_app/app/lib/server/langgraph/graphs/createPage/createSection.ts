import { StateGraph, START, END } from "@langchain/langgraph";
import { setupNode } from "~/lib/server/langgraph/nodes/createPage/createSection/setup";
import { GraphAnnotation } from "@state/graph";
import { planCreateSectionNode, createSectionNode } from "~/lib/server/langgraph/nodes/createPage/createSection";
import { graphParams } from "@graphs/params";
import { cachePolicy } from "@nodes/core/templates/base";

export const createSectionGraph = new StateGraph(GraphAnnotation)
    .addNode("startCreateSection", setupNode)
    .addNode("planCreateSection", planCreateSectionNode, { cachePolicy })
    .addNode("createSection", createSectionNode, { cachePolicy })

    .addEdge(START, "startCreateSection")
    .addEdge("startCreateSection", "planCreateSection")
    .addEdge("planCreateSection", "createSection")
    .addEdge("createSection", END)

export const graph = createSectionGraph.compile(graphParams);