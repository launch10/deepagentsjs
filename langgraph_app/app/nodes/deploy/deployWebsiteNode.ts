import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { JobRunAPIService } from "@services";
import { env } from "@core";
import { createChecklistTask, findChecklistTask, updateChecklistTask } from "@types";

const TASK_NAME = "WebsiteDeploy" as const;

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
    const task = findChecklistTask(state.tasks, TASK_NAME);

    // 1. Already completed or failed? No-op (idempotent)
    if (task?.status === "completed" || task?.status === "failed") {
      return {};
    }

    // 2. Task exists with result? Process it
    if (task?.status === "running" && task.result) {
      return {
        tasks: updateChecklistTask(state.tasks, TASK_NAME, { status: "completed" }),
        status: "completed",
        result: task.result,
      };
    }

    // 3. Task exists with error? Mark failed
    if (task?.status === "running" && task.error) {
      return {
        tasks: updateChecklistTask(state.tasks, TASK_NAME, { status: "failed" }),
        status: "failed",
        error: { message: task.error, node: "deployWebsiteNode" },
      };
    }

    // 4. Task already pending/running? Just waiting, no-op
    if (task?.status === "pending" || task?.status === "running") {
      return {};
    }

    // 5. First run: validate and fire-and-forget
    if (!state.jwt) {
      throw new Error("JWT token is required for API authentication");
    }
    if (!state.threadId) {
      throw new Error("Thread ID is required");
    }
    if (!state.websiteId) {
      throw new Error("Website ID is required");
    }

    const callbackUrl = `${env.LANGGRAPH_API_URL}/webhooks/job_run_callback`;
    const jobRunApi = new JobRunAPIService({ jwt: state.jwt });

    const jobRun = await jobRunApi.create({
      jobClass: "WebsiteDeploy",
      arguments: { website_id: state.websiteId },
      threadId: state.threadId,
      callbackUrl,
    });

    return {
      tasks: [...state.tasks, createChecklistTask(TASK_NAME, jobRun.id)],
      status: "pending",
    };
  }
);
