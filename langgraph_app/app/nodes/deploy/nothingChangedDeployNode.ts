import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { DeployAPIService } from "@rails_api";
import { type DeployGraphState } from "@annotation";
import { getLogger } from "@core";

/**
 * Node that handles the "nothing changed" case.
 * Creates a deploy record and immediately marks it completed,
 * since there's nothing to actually deploy.
 */
export const nothingChangedDeployNode = NodeMiddleware.use(
  {},
  async (
    state: DeployGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    const log = getLogger({ component: "nothingChangedDeployNode" });

    if (!state.projectId) {
      throw new Error("Project ID is required");
    }

    if (!config?.configurable?.thread_id) {
      throw new Error("Thread ID is required");
    }

    if (!state.jwt) {
      throw new Error("JWT token is required for API authentication");
    }

    const apiService = new DeployAPIService({ jwt: state.jwt });

    // Create the deploy record
    const deploy = await apiService.create({
      projectId: state.projectId as number,
      threadId: config.configurable.thread_id,
      instructions: state.instructions,
    });

    log.info({ deployId: deploy.id }, "Created deploy for nothing-changed case");

    // Immediately mark as completed
    await apiService.update(deploy.id, { status: "completed" });

    log.info({ deployId: deploy.id }, "Marked nothing-changed deploy as completed");

    return {
      deployId: deploy.id,
      status: "completed",
      nothingChanged: true,
    };
  }
);
