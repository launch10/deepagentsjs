import { type WebsiteGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@core";
import { lastHumanMessage } from "@types";
import { PlanPageService, type PlanPageOutputType, type PlanPageProps } from "@services";

/**
 * Node that plans the page content
 */
export const planPageNode = NodeMiddleware.use(
  async (
    state: WebsiteGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    const userRequest = lastHumanMessage(state);

    if (!userRequest) {
      throw new Error("No user request found");
    }

    const website = state.website;
    if (!website) {
      throw new Error("No website found");
    }

    const props = {
      websiteId: website.id,
      userRequest,
    } as PlanPageProps;

    const service = new PlanPageService();
    const output = await service.execute(props) as PlanPageOutputType;

    return {
      queue: output.codeTasks,
      componentOverviews: output.componentOverviews,
    };
  }
);