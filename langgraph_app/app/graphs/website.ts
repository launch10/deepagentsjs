import { StateGraph, END, START } from "@langchain/langgraph";
import { WebsiteAnnotation, type WebsiteGraphState } from "@annotation";
import {
  createChat,
  buildContext,
  websiteBuilderNode,
  cleanupFilesystemNode,
  syncFilesNode,
  cacheModeNode,
  isCacheModeEnabled,
  improveCopyNode,
} from "@nodes";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";

const routeAfterCreateChat = (state: WebsiteGraphState): string => {
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
  .addNode("createChat", createChat)
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

  .addEdge(START, "createChat")
  .addConditionalEdges("createChat", routeAfterCreateChat, {
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
  .addEdge("cleanupState", END);
