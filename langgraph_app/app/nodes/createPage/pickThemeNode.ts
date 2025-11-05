import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@core";
import { lastHumanMessage } from "@annotation";
import { PickThemeService } from "@services";
import { type WebsiteType } from "@types";

/**
 * Node that selects a theme for the website
 */
export const pickThemeNode = NodeMiddleware.use(
  async (
    state: WebsiteBuilderGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteBuilderGraphState>> => {
    const userRequest = lastHumanMessage(state);

    if (!userRequest) {
      throw new Error("No user request found");
    }
    const website = state.website as WebsiteType;
    if (!website) {
      throw new Error("No website found");
    }

    const service = new PickThemeService();
    await service.execute({ userRequest, website });

    return {} // Don't need to change state, we updated the database in the service
  }
);