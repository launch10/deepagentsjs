import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { PlanComponentService, type PlanComponentOutputType, type PlanComponentProps } from "@services";
import { ComponentOverviewModel } from "@models";

/**
 * Node that plans the component
 * Extends BaseNode for consistent infrastructure support
 */
class PlanComponentNode extends BaseNode<GraphState> {
  async execute(
    state: GraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<GraphState>> {
    const website = state.website;

    if (!website) {
      throw new Error("No website found");
    }

    const task = state.task;

    if (!task) {
      throw new Error("No task found");
    }

    const messages = state.messages;
    if (!messages) {
      throw new Error("No messages found");
    }

    if (!task.componentOverviewId) {
        throw new Error("Component overview ID is required");
    }
    const componentOverview = await ComponentOverviewModel.find(task.componentOverviewId);
    if (!componentOverview) {
        throw new Error("Component overview not found");
    }

    const service = new PlanComponentService();
    await service.execute({ task, website, messages, componentOverview }) as PlanComponentOutputType;

    return {}
  }
}

// Export as a function for use in the graph
export const planComponentNode = new PlanComponentNode().toNodeFunction();