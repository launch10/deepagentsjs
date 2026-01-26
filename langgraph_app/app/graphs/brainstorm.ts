import { StateGraph, START, END } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { brainstormAgent, createBrainstorm, handleCommand } from "@nodes";
import { withCreditExhaustion } from "./shared";

/**
 * The main brainstorm graph
 *
 * Credit exhaustion is detected via withCreditExhaustion wrapper,
 * which runs this graph as a subgraph, then calculates credit status.
 */
export const brainstormGraph = withCreditExhaustion(
  new StateGraph(BrainstormAnnotation)
    .addNode("createBrainstorm", createBrainstorm)
    .addNode("handleCommand", handleCommand)
    .addNode("brainstormAgent", brainstormAgent)

    .addEdge(START, "createBrainstorm")
    .addEdge("createBrainstorm", "handleCommand")
    .addEdge("handleCommand", "brainstormAgent")
    .addEdge("brainstormAgent", END),
  BrainstormAnnotation
);
