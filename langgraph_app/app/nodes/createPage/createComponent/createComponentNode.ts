import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { CreateComponentService, type CreateComponentOutputType, type CreateComponentProps } from "@services";
import { ComponentContentPlanModel } from "@models";

/**
 * Node that creates the component
 * Extends BaseNode for consistent infrastructure support
 */
class CreateComponentNode extends BaseNode<GraphState> {
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
    const contentPlan = await ComponentContentPlanModel.findBy({
        componentOverviewId: task.componentOverviewId,
    })
    if (!contentPlan) {
        throw new Error("No content plan found");
    }

    const service = new CreateComponentService();
    const output = await service.execute({ task, website, messages, contentPlan }) as CreateComponentOutputType;

    return {
      task: output.task,
      completedTasks: [output.task]
    };
  }
}

// Export as a function for use in the graph
export const createComponentNode = new CreateComponentNode().toNodeFunction();