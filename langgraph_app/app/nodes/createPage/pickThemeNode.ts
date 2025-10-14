import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { lastHumanMessage } from "@annotation";
import { PickThemeService } from "@services";
import { type WebsiteType } from "@types";

/**
 * Node that selects a theme for the website
 * Extends BaseNode for consistent infrastructure support
 */
class PickThemeNode extends BaseNode<GraphState> {
  async execute(
    state: GraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<GraphState>> {
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
}

// Export as a function for use in the graph
export const pickThemeNode = new PickThemeNode().toNodeFunction();