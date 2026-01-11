import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { DeployGraphState } from "@annotation";
import { JobRunAPIService } from "@services";
import { NodeMiddleware } from "@middleware";
import { Task } from "@types";

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
    state: DeployGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    const task = Task.findTask(state.tasks, TASK_NAME);

    // 1. Already completed or failed? No-op (idempotent)
    if (task?.status === "completed" || task?.status === "failed") {
      return {};
    }

    // 2. Task exists with result? Process it
    if (task?.status === "running" && task.result) {
      return {
        tasks: Task.updateTask(state.tasks, TASK_NAME, { status: "completed" }),
        status: "completed",
        result: task.result,
      };
    }

    // 3. Task exists with error? Mark failed
    if (task?.status === "running" && task.error) {
      return {
        tasks: Task.updateTask(state.tasks, TASK_NAME, { status: "failed" }),
        status: "failed",
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

    const jobRunApi = new JobRunAPIService({ jwt: state.jwt });

    // Note: callback URL is auto-constructed by Rails from LANGGRAPH_API_URL (SSRF prevention)
    const jobRun = await jobRunApi.create({
      jobClass: "CampaignDeploy",
      arguments: { campaign_id: state.campaignId },
      threadId: state.threadId,
    });

    return {
      tasks: [...state.tasks, Task.createTask(TASK_NAME, jobRun.id)],
      status: "pending",
    };
  }
);
