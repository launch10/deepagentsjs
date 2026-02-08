import { StateGraph, START, END } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import {
  brainstormAgent,
  createBrainstorm,
  handleCommand,
  createCompactConversationNode,
} from "@nodes";
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
    .addNode("compactConversation", createCompactConversationNode())

    .addEdge(START, "createBrainstorm")
    .addEdge("createBrainstorm", "handleCommand")
    .addEdge("handleCommand", "brainstormAgent")
    .addEdge("brainstormAgent", "compactConversation")
    .addEdge("compactConversation", END),
  BrainstormAnnotation
);
