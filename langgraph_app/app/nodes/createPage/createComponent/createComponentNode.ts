import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@core";
import { CreateComponentService, type CreateComponentOutputType, type CreateComponentProps } from "@services";
import { ComponentContentPlanModel } from "@models";

/**
 * Node that creates the component
 */
export const createComponentNode = NodeMiddleware.use(
  async (
    state: WebsiteBuilderGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteBuilderGraphState>> => {
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
);