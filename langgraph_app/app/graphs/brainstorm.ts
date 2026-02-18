import { StateGraph, START, END } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import {
  brainstormAgent,
  createBrainstorm,
  ensureAnswersSaved,
  skipTopic,
  createCompactConversationNode,
} from "@nodes";
import { createIntentGraph } from "./shared";
import type { BrainstormIntent } from "@types";

/**
 * The main brainstorm graph
 *
 * Uses createIntentGraph to route by intent:
 * - default: createBrainstorm → brainstormAgent → compactConversation
 * - help_me: same as default (agent reads intent to pick prompt)
 * - do_the_rest: same as default (agent reads intent to pick prompt)
 * - skip_topic: skipTopic → createBrainstorm → brainstormAgent → compactConversation
 *
 * Credit exhaustion is detected via createIntentGraph's withCreditExhaustion wrapper.
 */

const defaultSubgraph = new StateGraph(BrainstormAnnotation)
  .addNode("createBrainstorm", createBrainstorm)
  .addNode("brainstormAgent", brainstormAgent)
  .addNode("ensureAnswersSaved", ensureAnswersSaved)
  .addNode("compactConversation", createCompactConversationNode())
  .addEdge(START, "createBrainstorm")
  .addEdge("createBrainstorm", "brainstormAgent")
  .addEdge("brainstormAgent", "ensureAnswersSaved")
  .addEdge("ensureAnswersSaved", "compactConversation")
  .addEdge("compactConversation", END)
  .compile();

const skipTopicSubgraph = new StateGraph(BrainstormAnnotation)
  .addNode("skipTopic", skipTopic)
  .addNode("createBrainstorm", createBrainstorm)
  .addNode("brainstormAgent", brainstormAgent)
  .addNode("ensureAnswersSaved", ensureAnswersSaved)
  .addNode("compactConversation", createCompactConversationNode())
  .addEdge(START, "skipTopic")
  .addEdge("skipTopic", "createBrainstorm")
  .addEdge("createBrainstorm", "brainstormAgent")
  .addEdge("brainstormAgent", "ensureAnswersSaved")
  .addEdge("ensureAnswersSaved", "compactConversation")
  .addEdge("compactConversation", END)
  .compile();

export const brainstormGraph = createIntentGraph<BrainstormIntent["type"]>()({
  annotation: BrainstormAnnotation,
  intents: {
    skip_topic: skipTopicSubgraph,
    help_me: defaultSubgraph,
    do_the_rest: defaultSubgraph,
    default: defaultSubgraph,
  },
});
