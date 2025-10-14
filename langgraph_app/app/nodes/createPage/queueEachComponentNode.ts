import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { Send } from "@langchain/langgraph";

/**
 * Node that queues each component to be created
 * Extends BaseNode for consistent infrastructure support
 */
class QueueEachComponentNode extends BaseNode<GraphState> {
  async execute(
    state: GraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Send[]> {
    const queue = state.queue ?? [];

    return queue.map(task => new Send("createComponentGraph", { 
        ...state,
        task,
    }));
  }
}

// Export as a function for use in the graph
export const queueEachComponentNode = new QueueEachComponentNode().toNodeFunction();