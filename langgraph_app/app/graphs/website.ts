import { StateGraph, END, START } from "@langchain/langgraph";
import { WebsiteAnnotation } from "@annotation";
import { buildContext, websiteBuilderNode, cleanupFilesystemNode } from "@nodes";

export const websiteGraph = new StateGraph(WebsiteAnnotation)
  .addNode("buildContext", buildContext)
  .addNode("websiteBuilder", websiteBuilderNode)
  .addNode("cleanupFilesystem", cleanupFilesystemNode)

  .addEdge(START, "buildContext")
  .addEdge("buildContext", "websiteBuilder")
  .addEdge("websiteBuilder", "cleanupFilesystem")
  .addEdge("cleanupFilesystem", END);
