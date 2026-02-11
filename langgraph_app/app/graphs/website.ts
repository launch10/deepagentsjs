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
  cleanupFilesystemNode,
  syncWebsiteChangesNode,
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
  .addEdge(START, "updateWebsite")
  .addEdge("updateWebsite", "themeHandler")
  .addEdge("themeHandler", END)
  .compile();

/**
 * Improve copy - regenerates copy with different style
 */
const improveCopySubgraph = new StateGraph(WebsiteAnnotation)
  .addNode("updateWebsite", updateWebsite)
  .addNode("improveCopy", improveCopyNode)
  .addNode("cleanupFilesystem", cleanupFilesystemNode)
  .addNode("syncWebsiteChanges", syncWebsiteChangesNode)
  .addEdge(START, "updateWebsite")
  .addEdge("updateWebsite", "improveCopy")
  .addEdge("improveCopy", "cleanupFilesystem")
  .addEdge("cleanupFilesystem", "syncWebsiteChanges")
  .addEdge("syncWebsiteChanges", END)
  .compile();

/**
 * Website builder - full page generation flow
 * - buildContext fans out to websiteBuilder and recommendDomains in parallel
 * - Both converge at cleanupFilesystem (or cleanupState in cache mode)
 * - Includes cacheMode as internal optimization
 */
const routeFromRecommendDomains = (state: { messages?: unknown[] }): string => {
  if (isCacheModeEnabled(state)) {
    return "skipToEnd"; // In cache mode (create only), domain recs go directly to END (files already cached)
  }
  return "cleanupFilesystem";
};

const websiteBuilderSubgraph = new StateGraph(WebsiteAnnotation)
  .addNode("updateWebsite", updateWebsite)
  .addNode("buildContext", buildContext)
  .addNode("websiteBuilder", websiteBuilderNode)
  .addNode("compactConversation", compactConversationNode)
  .addNode("recommendDomains", domainRecommendationsNode)
  .addNode("cleanupFilesystem", cleanupFilesystemNode)
  .addNode("syncWebsiteChanges", syncWebsiteChangesNode)
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

  // websiteBuilder → compactConversation → cleanupFilesystem
  .addEdge("websiteBuilder", "compactConversation")
  .addEdge("compactConversation", "cleanupFilesystem")

  // recommendDomains routes based on mode
  .addConditionalEdges("recommendDomains", routeFromRecommendDomains, {
    skipToEnd: "skipToEnd",
    cleanupFilesystem: "cleanupFilesystem",
  })

  // Converge paths
  .addEdge("skipToEnd", END)
  .addEdge("cleanupFilesystem", "syncWebsiteChanges")
  .addEdge("syncWebsiteChanges", END)
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
