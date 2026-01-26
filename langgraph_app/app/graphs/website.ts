import { StateGraph, END, START } from "@langchain/langgraph";
import { WebsiteAnnotation, type WebsiteGraphState } from "@annotation";
import {
  buildContext,
  websiteBuilderNode,
  cleanupFilesystemNode,
  syncFilesNode,
  cacheModeNode,
  isCacheModeEnabled,
  improveCopyNode,
  calculateCreditStatusNode,
} from "@nodes";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";

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

export const websiteGraph = new StateGraph(WebsiteAnnotation)
  .addNode("buildContext", buildContext)
  .addNode("websiteBuilder", websiteBuilderNode)
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
  .addNode("calculateCreditStatus", calculateCreditStatusNode)

  // Chat is pre-created by Rails, route directly from START
  .addConditionalEdges(START, routeFromStart, {
    cacheMode: "cacheMode",
    buildContext: "buildContext",
    improveCopy: "improveCopy",
  })
  .addEdge("cacheMode", "cleanupState")
  .addEdge("buildContext", "websiteBuilder")
  .addEdge("websiteBuilder", "cleanupFilesystem")
  .addEdge("improveCopy", "cleanupFilesystem")
  .addEdge("cleanupFilesystem", "syncFiles")
  .addEdge("syncFiles", "cleanupState")
  .addEdge("cleanupState", "calculateCreditStatus")
  .addEdge("calculateCreditStatus", END);
