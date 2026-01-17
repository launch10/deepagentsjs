import { StateGraph, END, START } from "@langchain/langgraph";
import { WebsiteAnnotation, type WebsiteGraphState } from "@annotation";
import { createChat, buildContext, websiteBuilderNode, cleanupFilesystemNode, syncFilesNode } from "@nodes";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";

export const websiteGraph = new StateGraph(WebsiteAnnotation)
  .addNode("createChat", createChat)
  .addNode("buildContext", buildContext)
  .addNode("websiteBuilder", websiteBuilderNode)
  .addNode("cleanupFilesystem", cleanupFilesystemNode)
  .addNode("syncFiles", syncFilesNode)
  .addNode("cleanupState", (state: WebsiteGraphState, config: LangGraphRunnableConfig) => {
    return {
      command: undefined,
    };
  })

  .addEdge(START, "createChat")
  .addEdge("createChat", "buildContext")
  .addEdge("buildContext", "websiteBuilder")
  .addEdge("websiteBuilder", "cleanupFilesystem")
  .addEdge("cleanupFilesystem", "syncFiles")
  .addEdge("syncFiles", "cleanupState")
  .addEdge("cleanupState", END);
