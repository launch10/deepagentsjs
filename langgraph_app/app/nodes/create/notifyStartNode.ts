import { type GraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { NotifyStartService } from "@services";

/**
 * Node that notifies the user that the project has started building
 * Extends BaseNode for consistent infrastructure support
 */
class NotifyStartNode extends BaseNode<GraphState> {
  async execute(
    state: GraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<GraphState>> {
    return new NotifyStartService().execute({ messages: state.messages }, config);
  }
}

// Export as a function for use in the graph
export const notifyStartNode = new NotifyStartNode().toNodeFunction();