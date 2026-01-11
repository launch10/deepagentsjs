import { StateGraph, END, START } from "@langchain/langgraph";
import { CodingAgentAnnotation } from "@annotation";
import { buildContext, websiteBuilderNode, cleanupFilesystemNode, validateLinksNode } from "@nodes";

export const websiteGraph = new StateGraph(CodingAgentAnnotation)
  .addNode("buildContext", buildContext)
  .addNode("websiteBuilder", websiteBuilderNode)
  .addNode("validateLinks", validateLinksNode)
  .addNode("cleanupFilesystem", cleanupFilesystemNode)

  .addEdge(START, "buildContext")
  .addEdge("buildContext", "websiteBuilder")
  .addEdge("websiteBuilder", "validateLinks")
  .addConditionalEdges("validateLinks", (state) =>
    state.status === "completed" ? "cleanupFilesystem" : "codingAgent"
  )
  .addEdge("cleanupFilesystem", END);
