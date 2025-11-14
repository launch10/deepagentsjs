// import { StateGraph, END, START } from "@langchain/langgraph";
// import { GraphAnnotation } from "@annotation";
// import { type WebsiteGraphState } from "@state";
// import { createGraph } from "./create";
// import { nameProjectNode } from "@nodes";
// import { updateGraph } from "./update";
// import { graphParams } from "@core";
// import { isFirstMessage } from "@annotation";

// const router = async(state: WebsiteGraphState): Promise<string> => {
//     if (isFirstMessage(state)) {
//         return "nameProject";
//     }
//     return "update";
// }

// export const routerGraph = new StateGraph(GraphAnnotation)
//     .addNode("nameProject", nameProjectNode)
//     .addNode("create", createGraph)
//     .addNode("update", updateGraph)

//     .addConditionalEdges(START, router, {
//         "nameProject": "nameProject",
//         "update": "update"
//     })
//     .addEdge("nameProject", "create")
//     .addEdge("create", END) 
//     .addEdge("update", END)
//     .compile(graphParams)