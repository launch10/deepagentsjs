import { NodeMiddleware } from "@core";
import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NotifyStartService } from "@services";

/**
 * Node that notifies the user that the project has started building
 * Extends BaseNode for consistent infrastructure support
 */
export const notifyStartNode = NodeMiddleware.use(
  async (
    state: WebsiteBuilderGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteBuilderGraphState>> => {
    const service = new NotifyStartService();

    const result = await service.execute({ messages: state.messages }, config);

    return result;
  }
);