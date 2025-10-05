import { type GraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { lastHumanMessage } from "@annotation";
import { PlanWebsiteService } from "@services";

/**
 * Node that plans the website content
 * Extends BaseNode for consistent infrastructure support
 */
class PlanWebsiteNode extends BaseNode<GraphState> {
  async execute(
    state: GraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<GraphState>> {
    const userRequest = lastHumanMessage(state);

    if (!userRequest) {
      throw new Error("No user request found");
    }

    const service = new PlanWebsiteService();
    await service.execute({ userRequest, websiteId: state.website!.id });

    return {};
  }
}

// Export as a function for use in the graph
export const planWebsiteNode = new PlanWebsiteNode().toNodeFunction();