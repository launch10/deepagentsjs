import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { DeployAPIService } from "@rails_api";
import { type DeployGraphState } from "@annotation";
import { getLogger } from "@core";

/**
 * Node that creates a Deploy record via Rails API.
 * Mirrors the brainstorm pattern: first node in graph creates the record.
 *
 * The thread_id is stored directly on the Deploy record.
 *
 * Idempotent: skips if deployId already exists in state.
 */
export const createDeployNode = NodeMiddleware.use(
  {},
  async (
    state: DeployGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    const log = getLogger({ component: "initDeployNode" });

    // Already has a deploy — nothing to do
    if (state.deployId) {
      log.info({ deployId: state.deployId }, "Deploy already exists, skipping init");
      return {};
    }

    if (!state.projectId) {
      throw new Error("Project ID is required");
    }

    if (!config?.configurable?.thread_id) {
      throw new Error("Thread ID is required");
    }

    if (!state.jwt) {
      throw new Error("JWT token is required for API authentication");
    }

    log.info(
      { projectId: state.projectId, threadId: config.configurable.thread_id },
      "Creating deploy via Rails API"
    );

    const apiService = new DeployAPIService({ jwt: state.jwt });
    const deploy = await apiService.create({
      projectId: state.projectId as number,
      threadId: config.configurable.thread_id,
    });

    log.info({ deployId: deploy.id, threadId: deploy.thread_id }, "Deploy created");

    return {
      deployId: deploy.id,
    };
  }
);
