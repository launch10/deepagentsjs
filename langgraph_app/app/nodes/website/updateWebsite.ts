import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { WebsiteAPIService } from "@services";
import { type WebsiteGraphState } from "@annotation";

/**
 * Node that creates a Chat record for the website via Rails API.
 * Mirrors the createBrainstorm pattern: idempotent, runs early in the graph.
 */
export const updateWebsite = NodeMiddleware.use(
  {},
  async (
    state: WebsiteGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    // Already has a chat — nothing to do
    if (state.chatId) {
      return {};
    }

    if (!state.websiteId) {
      throw new Error("Website ID is required");
    }

    if (!config?.configurable?.thread_id) {
      throw new Error("Thread ID is required");
    }

    if (!state.jwt) {
      throw new Error("JWT token is required for API authentication");
    }

    const apiService = new WebsiteAPIService({ jwt: state.jwt });
    const result = await apiService.initializeChat(
      state.websiteId as number,
      config.configurable.thread_id
    );

    return {
      chatId: result.chat_id,
    };
  }
);
