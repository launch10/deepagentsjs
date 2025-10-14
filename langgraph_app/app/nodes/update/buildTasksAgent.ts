import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { BuildTasksService } from "@services";

/**
 * Node that builds tasks based on user requests using an agent with tools
 * Extends BaseNode for consistent infrastructure support
 */
class BuildTasksAgent extends BaseNode<GraphState> {
  async execute(
    state: GraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<GraphState>> {
    const { messages, consoleError } = state;

    if (!messages || messages.length === 0) {
      throw new Error("No messages found in state");
    }

    const service = new BuildTasksService();
    const result = await service.execute({ 
      website: state.website!,
      messages,
      consoleError 
    }, config);

    return {
      queue: result.queue
    };
  }
}

// Export as a function for use in the graph
export const buildTasksAgent = new BuildTasksAgent().toNodeFunction();