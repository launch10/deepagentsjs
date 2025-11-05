import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@core";

export const resetStateNode = NodeMiddleware.use(
  async (
    state: WebsiteBuilderGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteBuilderGraphState>> => {
    return {
      queue: [],
      completedTasks: []
    };
  }
);