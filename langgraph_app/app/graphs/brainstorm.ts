import { StateGraph, END, START } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { brainstormAgent } from "@nodes";
import { createWebsite } from "@nodes";

/**
 * Simple test graph for the new brainstorm agent
 * Usage: Load this in LangGraph Studio to test the agent
 */
export const brainstormGraph = new StateGraph(BrainstormAnnotation)
      .addNode("createWebsite", createWebsite)
      .addNode("agent", brainstormAgent)
      .addEdge(START, "agent")
      .addEdge("agent", END)