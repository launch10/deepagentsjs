import { NodeMiddleware } from "@core";
import { type WebsiteGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NotifyStartService } from "@services";

/**
 * Node that notifies the user that the project has started building
 */
export const notifyStartNode = NodeMiddleware.use(
  async (
    state: WebsiteGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    const service = new NotifyStartService();

    const result = await service.execute({ messages: state.messages }, config);

    return result;
  }
);