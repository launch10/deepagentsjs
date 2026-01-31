import { StateGraph, START, END } from "@langchain/langgraph";
import { WebsiteAnnotation, type WebsiteGraphState } from "@annotation";
import {
  buildContext,
  websiteBuilderNode,
  cleanupFilesystemNode,
  syncFilesNode,
  cacheModeNode,
  isCacheModeEnabled,
  improveCopyNode,
  domainRecommendationsNode,
} from "@nodes";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { withCreditExhaustion } from "./shared";

// Route from START based on mode and command
// Chat is pre-created by Rails via ChatCreatable, no createChat node needed
const routeFromStart = (state: WebsiteGraphState): string => {
  if (isCacheModeEnabled()) {
    return "cacheMode";
  }
  // Route to improve_copy node when that command is specified
  if (state.command === "improve_copy") {
    return "improveCopy";
  }
  return "buildContext";
};

/**
 * Website graph for building and updating landing pages.
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
    .addNode("cacheMode", cacheModeNode)
    .addNode("improveCopy", improveCopyNode)
    .addNode("cleanupState", (state: WebsiteGraphState, config: LangGraphRunnableConfig) => {
      return {
        command: undefined,
        improveCopyStyle: undefined,
      };
    })

    // Chat is pre-created by Rails, route directly from START
    .addConditionalEdges(START, routeFromStart, {
      cacheMode: "cacheMode",
      buildContext: "buildContext",
      improveCopy: "improveCopy",
    })
    .addEdge("cacheMode", "cleanupState")
    // buildContext fans out to websiteBuilder and recommendDomains in parallel
    .addEdge("buildContext", "websiteBuilder")
    .addEdge("buildContext", "recommendDomains")
    // Both converge at cleanupFilesystem
    .addEdge("websiteBuilder", "cleanupFilesystem")
    .addEdge("recommendDomains", "cleanupFilesystem")
    .addEdge("improveCopy", "cleanupFilesystem")
    .addEdge("cleanupFilesystem", "syncFiles")
    .addEdge("syncFiles", "cleanupState")
    .addEdge("cleanupState", END),
  WebsiteAnnotation
);
