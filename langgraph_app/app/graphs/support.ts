import { StateGraph, START, END } from "@langchain/langgraph";
import { SupportAnnotation } from "@annotation";
import { supportAgent } from "@nodes";
import { withCreditExhaustion } from "./shared";

/**
 * Support Chat Graph
 *
 * A conversational graph for the Help Center AI assistant.
 * The agent uses an FAQ tool to search the knowledge base
 * and answer user questions.
 *
 * Flow:
 * START → supportAgent → END
 *
 * Credit exhaustion is detected via withCreditExhaustion wrapper.
 */
export const supportGraph = withCreditExhaustion(
  new StateGraph(SupportAnnotation)
    .addNode("supportAgent", supportAgent)
    .addEdge(START, "supportAgent")
    .addEdge("supportAgent", END),
  SupportAnnotation
);
