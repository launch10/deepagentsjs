import { StateGraph, END, START } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { brainstormAgent } from "@nodes";
import { createBrainstorm } from "@nodes";
import { handleCommand } from "@nodes";

/**
 * The main brainstorm graph
 */
export const brainstormGraph = new StateGraph(BrainstormAnnotation)
  .addNode("createBrainstorm", createBrainstorm)
  .addNode("handleCommand", handleCommand)
  .addNode("brainstormAgent", brainstormAgent)

  .addEdge(START, "createBrainstorm")
  .addEdge("createBrainstorm", "handleCommand")
  .addEdge("handleCommand", "brainstormAgent")
  .addEdge("brainstormAgent", END);
