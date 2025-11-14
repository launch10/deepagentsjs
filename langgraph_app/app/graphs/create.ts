// import { StateGraph, END, START } from "@langchain/langgraph";
// import { GraphAnnotation } from "@annotation";
// import { notifyStartNode, planWebsiteNode } from "@nodes";
// import { createPageGraph } from "./createPage";
// import { graphParams } from "@core";

// export const createGraph = new StateGraph(GraphAnnotation)
//     .addNode("notifyStart", notifyStartNode)
//     .addNode("loadProject", loadProjectNode)
//     .addNode("planWebsite", planWebsiteNode)
//     .addNode("createPageGraph", createPageGraph)

//     .addEdge(START, "notifyStart")
//     .addEdge("notifyStart", "createProject")
//     .addEdge("createProject", "planWebsite")
//     .addEdge("planWebsite", "createPageGraph")
//     .addEdge("createPageGraph", END)
//     .compile(graphParams)