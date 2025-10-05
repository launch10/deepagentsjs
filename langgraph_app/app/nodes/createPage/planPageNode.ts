import { type GraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { lastHumanMessage } from "@annotation";
import { PlanPageService, type PlanPageOutputType, type PlanPageProps } from "@services";
import { ContentStrategyModel } from "@models";
import { ThemeModel } from "@models";

/**
 * Node that plans the page content
 * Extends BaseNode for consistent infrastructure support
 */
class PlanPageNode extends BaseNode<GraphState> {
  async execute(
    state: GraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<GraphState>> {
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
}

// Export as a function for use in the graph
export const planPageNode = new PlanPageNode().toNodeFunction();