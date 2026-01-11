import { StateGraph, END, START } from "@langchain/langgraph";
import { CodingAgentAnnotation } from "@annotation";
import { buildContext, codingAgentNode, cleanupFilesystemNode, staticValidationNode } from "@nodes";

export const codingAgentGraph = new StateGraph(CodingAgentAnnotation)
  .addNode("buildContext", buildContext)
  .addNode("codingAgent", codingAgentNode)
  .addNode("staticValidation", staticValidationNode)
  .addNode("cleanupFilesystem", cleanupFilesystemNode)

  .addEdge(START, "buildContext")
  .addEdge("buildContext", "codingAgent")
  .addEdge("codingAgent", "staticValidation")
  .addConditionalEdges("staticValidation", (state) =>
    state.status === "completed" ? "cleanupFilesystem" : "codingAgent"
  )
  .addEdge("cleanupFilesystem", END);
