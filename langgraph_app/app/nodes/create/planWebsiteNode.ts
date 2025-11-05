import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@core";
import { lastHumanMessage } from "@annotation";
import { PlanWebsiteService } from "@services";

/**
 * Node that plans the website content
 * Extends BaseNode for consistent infrastructure support
 */
export const planWebsiteNode = NodeMiddleware.use(
  async (
    state: WebsiteBuilderGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteBuilderGraphState>> => {
    const userRequest = lastHumanMessage(state);

    if (!userRequest) {
      throw new Error("No user request found");
    }

    const service = new PlanWebsiteService();
    if (!state.website?.id) {
      throw new Error("No website id found");
    }
    await service.execute({ userRequest, websiteId: state.website.id });

    return {};
  }
);