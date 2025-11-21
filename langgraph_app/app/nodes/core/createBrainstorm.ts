import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { BrainstormAPIService } from "@services";
import { type BrainstormGraphState } from "@state";

/**
 * Node that creates a new brainstorm, project, or website
 */
export const createBrainstorm = NodeMiddleware.use({}, async (
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> => {
    // No need to create a new brainstorm
    if (state.websiteId) {
      return state;
    }

    if (!config?.configurable?.thread_id) {
      throw new Error("Thread ID is required");
    }

    if (!state.jwt) {
      throw new Error("JWT token is required for API authentication");
    }

    const apiService = new BrainstormAPIService({ jwt: state.jwt });
    const brainstorm = await apiService.create({
      threadId: config.configurable.thread_id,
      projectUUID: state.projectUUID,
    });

    return { 
      brainstormId: brainstorm.id,
      websiteId: brainstorm.website_id,
      projectId: brainstorm.project_id,
    };
  }
);