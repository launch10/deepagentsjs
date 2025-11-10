import { type WebsiteGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@core";

export const resetStateNode = NodeMiddleware.use(
  async (
    state: WebsiteGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    return {
      queue: [],
      completedTasks: []
    };
  }
);