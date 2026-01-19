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
} from "@nodes";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";

const routeAfterCreateChat = (state: WebsiteGraphState): string => {
  if (isCacheModeEnabled()) {
    return "cacheMode";
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
  .addNode("cleanupState", (state: WebsiteGraphState, config: LangGraphRunnableConfig) => {
    return {
      command: undefined,
    };
  })

  .addEdge(START, "createChat")
  .addConditionalEdges("createChat", routeAfterCreateChat, {
    cacheMode: "cacheMode",
    buildContext: "buildContext",
  })
  .addEdge("cacheMode", "cleanupState")
  .addEdge("buildContext", "websiteBuilder")
  .addEdge("websiteBuilder", "cleanupFilesystem")
  .addEdge("cleanupFilesystem", "syncFiles")
  .addEdge("syncFiles", "cleanupState")
  .addEdge("cleanupState", END);
