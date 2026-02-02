import { StateGraph, START, END } from "@langchain/langgraph";
import { WebsiteAnnotation, type WebsiteGraphState } from "@annotation";
import {
  buildContext,
  websiteBuilderNode,
  cleanupFilesystemNode,
  syncFilesNode,
  improveCopyNode,
  domainRecommendationsNode,
} from "@nodes";
import { isCacheModeEnabled } from "@nodes";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { withCreditExhaustion } from "./shared";

// Route from START based on command
const routeFromStart = (state: WebsiteGraphState): string => {
  if (state.command === "improve_copy") {
    return "improveCopy";
  }
  return "buildContext";
};

// Route from recommendDomains based on mode
// In CACHE_MODE: skip cleanupFilesystem/syncFiles (files already provided by websiteBuilder cache)
// In normal mode: converge with websiteBuilder at cleanupFilesystem
const routeFromRecommendDomains = (): string => {
  if (isCacheModeEnabled()) {
    return "cleanupState";
  }
  return "cleanupFilesystem";
};

/**
 * Website graph for building and updating landing pages.
 *
 * Flow:
 * - buildContext -> [websiteBuilder, recommendDomains] in parallel (or improveCopy alone)
 * - websiteBuilder -> cleanupFilesystem -> syncFiles -> cleanupState -> END
 * - recommendDomains -> cleanupFilesystem (normal) or cleanupState (cache mode)
 *
 * In CACHE_MODE, websiteBuilder returns cached files immediately (no agent invocation).
 *
 * Credit exhaustion is detected via withCreditExhaustion wrapper,
 * which runs this graph as a subgraph, then calculates credit status.
 */
export const websiteGraph = withCreditExhaustion(
  new StateGraph(WebsiteAnnotation)
    .addNode("buildContext", buildContext)
    .addNode("websiteBuilder", websiteBuilderNode)
    .addNode("recommendDomains", domainRecommendationsNode)
    .addNode("cleanupFilesystem", cleanupFilesystemNode)
    .addNode("syncFiles", syncFilesNode)
    .addNode("improveCopy", improveCopyNode)
    .addNode("cleanupState", (state: WebsiteGraphState, config: LangGraphRunnableConfig) => {
      return {
        command: undefined,
        improveCopyStyle: undefined,
      };
    })

    // Route from START: improve_copy skips buildContext, others go through it
    .addConditionalEdges(START, routeFromStart, {
      improveCopy: "improveCopy",
      buildContext: "buildContext",
    })
    // buildContext fans out to websiteBuilder and recommendDomains in parallel
    .addEdge("buildContext", "websiteBuilder")
    .addEdge("buildContext", "recommendDomains")
    // websiteBuilder always goes to cleanupFilesystem
    .addEdge("websiteBuilder", "cleanupFilesystem")
    // recommendDomains routes based on mode:
    // - CACHE_MODE: directly to cleanupState (files already provided by websiteBuilder)
    // - Normal: converge with websiteBuilder at cleanupFilesystem
    .addConditionalEdges("recommendDomains", routeFromRecommendDomains, {
      cleanupState: "cleanupState",
      cleanupFilesystem: "cleanupFilesystem",
    })
    .addEdge("improveCopy", "cleanupFilesystem")
    .addEdge("cleanupFilesystem", "syncFiles")
    .addEdge("syncFiles", "cleanupState")
    .addEdge("cleanupState", END),
  WebsiteAnnotation
);
