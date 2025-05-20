import { StateGraph, START, END } from "@langchain/langgraph";
import { setupNode } from "~/lib/.server/langgraph/nodes/createPage/createSection/setup";
import { GraphAnnotation } from "@state/graph";
import { planCreateSectionNode, createSectionNode } from "~/lib/.server/langgraph/nodes/createPage/createSection";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

export const createSectionGraph = new StateGraph(GraphAnnotation)
    .addNode("startCreateSection", setupNode)
    .addNode("planCreateSection", planCreateSectionNode)
    .addNode("createSection", createSectionNode)

    .addEdge(START, "startCreateSection")
    .addEdge("startCreateSection", "planCreateSection")
    .addEdge("planCreateSection", "createSection")
    .addEdge("createSection", END)

// export const checkpointer = PostgresSaver.fromConnString(process.env.POSTGRES_URI!);
// await checkpointer.setup();
// export const graph = createSectionGraph.compile({ checkpointer });

export const graph = createSectionGraph.compile();