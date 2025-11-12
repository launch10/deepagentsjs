import { StateGraph, END, START } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { brainstormAgent } from "@nodes";
import { createBrainstorm } from "@nodes";

/**
 * Simple test graph for the new brainstorm agent
 * Usage: Load this in LangGraph Studio to test the agent
 */
export const brainstormGraph = new StateGraph(BrainstormAnnotation)
      .addNode("createBrainstorm", createBrainstorm)
      .addNode("agent", brainstormAgent)

      .addEdge(START, "createBrainstorm")
      .addEdge("createBrainstorm", "agent")
      .addEdge("agent", END)