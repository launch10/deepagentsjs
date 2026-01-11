import { StateGraph, END, START } from "@langchain/langgraph";
import { WebsiteAnnotation } from "@annotation";
import { buildContext, websiteBuilderNode, cleanupFilesystemNode, validateLinksNode } from "@nodes";

export const websiteGraph = new StateGraph(WebsiteAnnotation)
  .addNode("buildContext", buildContext)
  .addNode("websiteBuilder", websiteBuilderNode)
  .addNode("validateLinks", validateLinksNode)
  .addNode("cleanupFilesystem", cleanupFilesystemNode)

  .addEdge(START, "buildContext")
  .addEdge("buildContext", "websiteBuilder")
  .addEdge("websiteBuilder", "validateLinks")
  .addConditionalEdges("validateLinks", (state) =>
    state.status === "completed" ? "cleanupFilesystem" : "websiteBuilder"
  )
  .addEdge("cleanupFilesystem", END);
