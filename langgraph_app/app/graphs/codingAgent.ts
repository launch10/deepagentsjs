import { StateGraph, END, START } from "@langchain/langgraph";
import { CodingAgentAnnotation } from "@annotation";
import { buildContext, codingAgentNode, cleanupNode } from "@nodes";

export const codingAgentGraph = new StateGraph(CodingAgentAnnotation)
  .addNode("buildContext", buildContext)
  .addNode("codingAgent", codingAgentNode)
  .addNode("cleanup", cleanupNode)

  .addEdge(START, "buildContext")
  .addEdge("buildContext", "codingAgent")
  .addEdge("codingAgent", "cleanup")
  .addEdge("cleanup", END);
