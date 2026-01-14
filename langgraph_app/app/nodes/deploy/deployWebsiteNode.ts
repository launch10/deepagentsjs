import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { JobRunAPIService } from "@services";
import { env } from "@core";
import { Task } from "@types";

const TASK_NAME = "DeployingWebsite" as const;

/**
 * Deploy Website Node (Idempotent Pattern)
 *
 * Uses the fire-and-forget + idempotent pattern:
 * 1. First invocation: fires Rails job, creates task with "pending" status
 * 2. Subsequent invocations with pending/running task: returns {} (no-op)
 * 3. When webhook updates task with result: processes result, marks completed
 * 4. Already completed/failed: returns {} (no-op)
 */
export const deployWebsiteNode = NodeMiddleware.use(
  {},
  async (
    state: DeployGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    const task = Task.findTask(state.tasks, TASK_NAME);

    if (!task) {
      throw new Error("DeployingWebsite task not found");
    }

    // 1. If task is not running, we're done
    if (task?.status !== "running") {
      return {};
    }

    // 2. Did webhook return us a result? We're done.
    if (task?.result) {
      return {
        tasks: Task.updateTask(state.tasks, TASK_NAME, { status: "completed" }),
        status: "completed",
        result: task.result,
      };
    }

    // 3. Did webhook return us an error? We're done.
    if (task.error) {
      return {
        tasks: Task.updateTask(state.tasks, TASK_NAME, { status: "failed" }),
        status: "failed",
        error: { message: task.error, node: "deployWebsiteNode" },
      };
    }

    if (task.jobId) {
      // we already enqueued, we're just waiting for the webhook
      return {};
    }

    // 4. We haven't fired a webhook yet. Do so now.
    if (!state.jwt) {
      throw new Error("JWT token is required for API authentication");
    }
    if (!state.threadId) {
      throw new Error("Thread ID is required");
    }
    if (!state.websiteId) {
      throw new Error("Website ID is required");
    }

    const jobRunApi = new JobRunAPIService({ jwt: state.jwt });

    const jobRun = await jobRunApi.create({
      jobClass: "WebsiteDeploy",
      arguments: { website_id: state.websiteId },
      threadId: state.threadId,
    });

    return {
      tasks: [
        {
          ...task,
          jobId: jobRun.id,
        },
      ],
    };
  }
);
