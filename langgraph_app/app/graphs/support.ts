import { StateGraph, START, END } from "@langchain/langgraph";
import { SupportAnnotation } from "@annotation";
import { loadFaqContext, supportAgent } from "@nodes";
import { withCreditExhaustion } from "./shared";

/**
 * Support Chat Graph
 *
 * A simple conversational graph for the Help Center AI assistant.
 * Loads FAQ context from the database, then runs a support agent
 * that answers questions using that context.
 *
 * Flow:
 * START → loadFaqContext → supportAgent → END
 *
 * Credit exhaustion is detected via withCreditExhaustion wrapper.
 */
export const supportGraph = withCreditExhaustion(
  new StateGraph(SupportAnnotation)
    .addNode("loadFaqContext", loadFaqContext)
    .addNode("supportAgent", supportAgent)
    .addEdge(START, "loadFaqContext")
    .addEdge("loadFaqContext", "supportAgent")
    .addEdge("supportAgent", END),
  SupportAnnotation
);
