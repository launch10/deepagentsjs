/**
 * Website Graph
 *
 * Intent-routed graph for building and updating landing pages.
 *
 * Supported intents:
 * - change_theme: Update website theme (silent, no AI)
 * - improve_copy: Regenerate copy with different style
 * - default: Full website builder flow (with parallel domain recommendations)
 */
import { StateGraph, START, END } from "@langchain/langgraph";
import { WebsiteAnnotation } from "@annotation";
import {
  websiteBuilderNode,
  afterAgentNode,
  improveCopyNode,
  domainRecommendationsNode,
  themeHandler,
  isCacheModeEnabled,
  updateWebsite,
} from "@nodes";
import { createIntentGraph } from "./shared";
import type { WebsiteIntent } from "@types";

// =============================================================================
// Subgraphs
// =============================================================================

/**
 * Theme handler - silent action, no AI messages
 */
const themeHandlerSubgraph = new StateGraph(WebsiteAnnotation)
  .addNode("updateWebsite", updateWebsite)
  .addNode("themeHandler", themeHandler)
  .addNode("afterAgent", afterAgentNode)
  .addEdge(START, "updateWebsite")
  .addEdge("updateWebsite", "themeHandler")
  .addEdge("themeHandler", "afterAgent")
  .addEdge("afterAgent", END)
  .compile();

/**
 * Improve copy - regenerates copy with different style.
 * Uses the full coding agent (same as edit flow) with copy style as context.
 */
const improveCopySubgraph = new StateGraph(WebsiteAnnotation)
  .addNode("updateWebsite", updateWebsite)
  .addNode("improveCopy", improveCopyNode)
  .addNode("afterAgent", afterAgentNode)
  .addEdge(START, "updateWebsite")
  .addEdge("updateWebsite", "improveCopy")
  .addEdge("improveCopy", "afterAgent")
  .addEdge("afterAgent", END)
  .compile();

/**
 * Website builder - full page generation flow
 * - updateWebsite fans out to websiteBuilder and recommendDomains in parallel
 * - Both converge at afterAgent (or skipToEnd in cache mode)
 * - afterAgent handles: filesystem cleanup, DB sync, todos clear
 *
 * Context preparation (event fetching, injection, windowing) and compaction
 * happen inside websiteBuilder via Conversation.start() — no separate nodes needed.
 */
const routeFromRecommendDomains = (state: { messages?: unknown[] }): string => {
  if (isCacheModeEnabled(state)) {
    return "skipToEnd"; // In cache mode (create only), domain recs go directly to END (files already cached)
  }
  return "afterAgent";
};

const websiteBuilderSubgraph = new StateGraph(WebsiteAnnotation)
  .addNode("updateWebsite", updateWebsite)
  .addNode("websiteBuilder", websiteBuilderNode)
  .addNode("recommendDomains", domainRecommendationsNode)
  .addNode("afterAgent", afterAgentNode)
  .addNode("skipToEnd", () => ({})) // No-op node for cache mode domain recs path

  // START → updateWebsite → fan out to websiteBuilder + recommendDomains
  .addEdge(START, "updateWebsite")
  .addEdge("updateWebsite", "websiteBuilder")
  .addEdge("updateWebsite", "recommendDomains")

  // websiteBuilder → afterAgent (compaction now happens inside websiteBuilder via Conversation.start)
  .addEdge("websiteBuilder", "afterAgent")

  // recommendDomains routes based on mode
  .addConditionalEdges("recommendDomains", routeFromRecommendDomains, {
    skipToEnd: "skipToEnd",
    afterAgent: "afterAgent",
  })

  // Converge paths
  .addEdge("skipToEnd", END)
  .addEdge("afterAgent", END)
  .compile();

// =============================================================================
// Main Graph
// =============================================================================

export const websiteGraph = createIntentGraph<WebsiteIntent["type"]>()({
  annotation: WebsiteAnnotation,
  intents: {
    change_theme: themeHandlerSubgraph,
    improve_copy: improveCopySubgraph,
    default: websiteBuilderSubgraph,
  },
});
