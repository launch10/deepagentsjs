import { StateGraph, START, END } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { brainstormAgent, cleanup, createBrainstorm, ensureAnswersSaved, skipTopic } from "@nodes";
import { createIntentGraph } from "./shared";
import type { BrainstormIntent } from "@types";

/**
 * The main brainstorm graph
 *
 * Uses createIntentGraph to route by intent:
 * - default: createBrainstorm → brainstormAgent → ensureAnswersSaved → cleanup
 * - help_me: same as default (agent reads intent to pick prompt)
 * - do_the_rest: same as default (agent reads intent to pick prompt)
 * - skip_topic: skipTopic → createBrainstorm → brainstormAgent → ...
 *
 * Compaction is handled inside brainstormAgent via Conversation.start().
 * Credit exhaustion is detected via createIntentGraph's withCreditExhaustion wrapper.
 */

const defaultSubgraph = new StateGraph(BrainstormAnnotation)
  .addNode("createBrainstorm", createBrainstorm)
  .addNode("brainstormAgent", brainstormAgent)
  .addNode("ensureAnswersSaved", ensureAnswersSaved)
  .addNode("cleanup", cleanup)
  .addEdge(START, "createBrainstorm")
  .addEdge("createBrainstorm", "brainstormAgent")
  .addEdge("brainstormAgent", "ensureAnswersSaved")
  .addEdge("ensureAnswersSaved", "cleanup")
  .addEdge("cleanup", END)
  .compile();

const skipTopicSubgraph = new StateGraph(BrainstormAnnotation)
  .addNode("skipTopic", skipTopic)
  .addNode("createBrainstorm", createBrainstorm)
  .addNode("brainstormAgent", brainstormAgent)
  .addNode("ensureAnswersSaved", ensureAnswersSaved)
  .addNode("cleanup", cleanup)
  .addEdge(START, "skipTopic")
  .addEdge("skipTopic", "createBrainstorm")
  .addEdge("createBrainstorm", "brainstormAgent")
  .addEdge("brainstormAgent", "ensureAnswersSaved")
  .addEdge("ensureAnswersSaved", "cleanup")
  .addEdge("cleanup", END)
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
