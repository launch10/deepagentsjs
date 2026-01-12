import { StateGraph, END, START } from "@langchain/langgraph";
import { WebsiteAnnotation, type WebsiteGraphState } from "@annotation";
import { buildContext, websiteBuilderNode, cleanupFilesystemNode } from "@nodes";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";

export const websiteGraph = new StateGraph(WebsiteAnnotation)
  .addNode("buildContext", buildContext)
  .addNode("websiteBuilder", websiteBuilderNode)
  .addNode("cleanupFilesystem", cleanupFilesystemNode)
  .addNode("cleanupState", (state: WebsiteGraphState, config: LangGraphRunnableConfig) => {
    return {
      command: undefined,
    };
  })

  .addEdge(START, "buildContext")
  .addEdge("buildContext", "websiteBuilder")
  .addEdge("websiteBuilder", "cleanupFilesystem")
  .addEdge("cleanupFilesystem", "cleanupState")
  .addEdge("cleanupState", END);
