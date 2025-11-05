import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@core";
import { BuildTasksService } from "@services";

/**
 * Node that builds tasks based on user requests using an agent with tools
 * Extends BaseNode for consistent infrastructure support
 */
export const buildTasksAgent = NodeMiddleware.use(
  async (
    state: WebsiteBuilderGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteBuilderGraphState>> => {
    const { messages, consoleErrors } = state;

    if (!messages || messages.length === 0) {
      throw new Error("No messages found in state");
    }

    const service = new BuildTasksService();
    const result = await service.execute({ 
      website: state.website!,
      messages,
      consoleErrors 
    }, config);

    return {
      queue: result.queue
    };
  }
);