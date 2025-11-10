import { StateGraph, END, START } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { BrainstormAnnotation } from "@annotation";
import { brainstormAgent } from "@nodes";

/**
 * Simple test graph for the new brainstorm agent
 * Usage: Load this in LangGraph Studio to test the agent
 */
export function createSampleAgent(checkpointer?: any, graphName: string = 'sample') {
  return new StateGraph(BrainstormAnnotation)
      .addNode("agent", NodeMiddleware.use({}, brainstormAgent))
      .addEdge(START, "agent")
      .addEdge("agent", END)
      .compile({ checkpointer, name: graphName });
}