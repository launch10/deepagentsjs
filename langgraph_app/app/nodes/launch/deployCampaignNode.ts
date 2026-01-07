import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { LaunchGraphState } from "@annotation";
import { JobRunAPIService } from "@services";
import { NodeMiddleware } from "@middleware";
import { env } from "@core";
import { createChecklistTask, findChecklistTask, updateChecklistTask } from "@types";

const TASK_NAME = "CampaignDeploy";

/**
 * Deploy Campaign Node (Idempotent Pattern)
 *
 * This node uses the fire-and-forget + idempotent pattern:
 * 1. First invocation: fires Rails job, creates task with "pending" status
 * 2. Subsequent invocations with pending/running task: returns {} (no-op)
 * 3. When webhook updates task with result: processes result, marks completed
 * 4. Already completed/failed: returns {} (no-op)
 *
 * The node is fully idempotent - safe to run multiple times without side effects.
 */
export const deployCampaignNode = NodeMiddleware.use(
  {},
  async (
    state: LaunchGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<LaunchGraphState>> => {
    const task = findChecklistTask(state.tasks, TASK_NAME);

    // 1. Already completed or failed? No-op (idempotent)
    if (task?.status === "completed" || task?.status === "failed") {
      return {};
    }

    // 2. Task exists with result? Process it
    if (task?.status === "running" && task.result) {
      return {
        tasks: updateChecklistTask(state.tasks, TASK_NAME, { status: "completed" }),
        deployStatus: "completed",
        deployResult: task.result,
      };
    }

    // 3. Task exists with error? Mark failed
    if (task?.status === "running" && task.error) {
      return {
        tasks: updateChecklistTask(state.tasks, TASK_NAME, { status: "failed" }),
        deployStatus: "failed",
        error: { message: task.error, node: "deployCampaignNode" },
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
    if (!state.campaignId) {
      throw new Error("Campaign ID is required");
    }

    const callbackUrl = `${env.LANGGRAPH_API_URL}/webhooks/job_run_callback`;
    const jobRunApi = new JobRunAPIService({ jwt: state.jwt });

    const jobRun = await jobRunApi.create({
      jobClass: "CampaignDeploy",
      arguments: { campaign_id: state.campaignId },
      threadId: state.threadId,
      callbackUrl,
    });

    return {
      tasks: [...state.tasks, createChecklistTask(TASK_NAME, jobRun.id)],
      deployStatus: "pending",
    };
  }
);
