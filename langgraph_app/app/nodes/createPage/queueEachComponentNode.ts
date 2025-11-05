import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@core";
import { Send } from "@langchain/langgraph";

/**
 * Node that queues each component to be created
 */
export const queueEachComponentNode = NodeMiddleware.use(
  async (
    state: WebsiteBuilderGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Send[]> => {
    const queue = state.queue ?? [];

    return queue.map(task => new Send("createComponentGraph", { 
        ...state,
        task,
    }));
  }
);