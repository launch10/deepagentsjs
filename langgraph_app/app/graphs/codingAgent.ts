import { StateGraph, END, START } from "@langchain/langgraph";
import { CodingAgentAnnotation } from "@annotation";
import { initializeCodingAgent, codingAgentNode } from "@nodes";

export const codingAgentGraph = new StateGraph(CodingAgentAnnotation)
  .addNode("initialize", initializeCodingAgent)
  .addNode("codingAgent", codingAgentNode)

  .addEdge(START, "initialize")
  .addEdge("initialize", "codingAgent")
  .addEdge("codingAgent", END);
