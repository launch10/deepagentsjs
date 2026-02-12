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
  buildContext,
  websiteBuilderNode,
  compactConversationNode,
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
  .addNode("compactConversation", compactConversationNode)
  .addNode("afterAgent", afterAgentNode)
  .addEdge(START, "updateWebsite")
  .addEdge("updateWebsite", "improveCopy")
  .addEdge("improveCopy", "compactConversation")
  .addEdge("compactConversation", "afterAgent")
  .addEdge("afterAgent", END)
  .compile();

/**
 * Website builder - full page generation flow
 * - buildContext fans out to websiteBuilder and recommendDomains in parallel
 * - Both converge at afterAgent (or skipToEnd in cache mode)
 * - afterAgent handles: filesystem cleanup, DB sync, todos clear
 */
const routeFromRecommendDomains = (state: { messages?: unknown[] }): string => {
  if (isCacheModeEnabled(state)) {
    return "skipToEnd"; // In cache mode (create only), domain recs go directly to END (files already cached)
  }
  return "afterAgent";
};

const websiteBuilderSubgraph = new StateGraph(WebsiteAnnotation)
  .addNode("updateWebsite", updateWebsite)
  .addNode("buildContext", buildContext)
  .addNode("websiteBuilder", websiteBuilderNode)
  .addNode("compactConversation", compactConversationNode)
  .addNode("recommendDomains", domainRecommendationsNode)
  .addNode("afterAgent", afterAgentNode)
  .addNode("skipToEnd", () => ({})) // No-op node for cache mode domain recs path

  // START → updateWebsite → buildContext (with cache mode routing)
  .addEdge(START, "updateWebsite")
  .addConditionalEdges("updateWebsite", (state) => (isCacheModeEnabled(state) ? "cacheMode" : "buildContext"), {
    cacheMode: "buildContext", // Even in cache mode, we go through buildContext
    buildContext: "buildContext",
  })

  // buildContext fans out to websiteBuilder and recommendDomains in parallel
  .addEdge("buildContext", "websiteBuilder")
  .addEdge("buildContext", "recommendDomains")

  // websiteBuilder → compactConversation → afterAgent
  .addEdge("websiteBuilder", "compactConversation")
  .addEdge("compactConversation", "afterAgent")

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
