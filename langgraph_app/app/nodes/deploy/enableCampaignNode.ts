import { type DeployGraphState, withPhases } from "@annotation";
import { JobRunAPIService } from "@rails_api";
import { DeployService } from "@services";
import { Deploy, Task } from "@types";
import { type TaskRunner, registerTask, isTaskDone } from "./taskRunner";

const TASK_NAME: Deploy.TaskName = "EnablingCampaign";

/**
 * Enable Campaign Node (Idempotent Pattern)
 *
 * This node enables a Google Ads campaign for serving:
 * 1. First invocation: fires Rails job to enable campaign
 * 2. Subsequent invocations with running task + jobId: returns {} (waiting for webhook)
 * 3. When webhook updates task with result: marks completed
 * 4. When webhook updates task with error: marks failed
 * 5. Already completed/failed: returns {} (no-op)
 *
 * IMPORTANT: This node should only be called AFTER:
 * - deployCampaignNode has created the campaign (PAUSED state)
 * - checkPaymentNode has verified payment is configured
 *
 * If payment is not verified, the campaign will not serve ads even if enabled.
 */
export const enableCampaignNode = async (
  state: DeployGraphState
): Promise<Partial<DeployGraphState>> => {
  const task = Task.findTask(state.tasks, TASK_NAME);

  // 1. Already completed or failed? No-op (idempotent)
  if (task?.status === "completed" || task?.status === "failed") {
    return {};
  }

  // 2. Task running with result from webhook (enabled)? Mark completed
  if (task?.status === "running" && task.result?.enabled !== undefined) {
    return withPhases(state, [{ ...task, status: "completed" } as Task.Task], [TASK_NAME]);
  }

  // 3. Task running with error from webhook? Mark failed
  if (task?.status === "running" && task.error !== undefined) {
    return withPhases(state, [{ ...task, status: "failed" } as Task.Task], [TASK_NAME]);
  }

  // 4. Task running with jobId? Waiting for worker to complete
  //    Touch the deploy to indicate user is still active
  if (task?.status === "running" && task.jobId) {
    if (state.deployId) {
      DeployService.touch(state.deployId).catch(() => {});
    }
    return {};
  }

  // 5. Validate required fields before creating JobRun
  if (!state.jwt) {
    throw new Error("JWT token is required for API authentication");
  }
  if (!state.threadId) {
    throw new Error("Thread ID is required");
  }
  if (!state.campaignId) {
    throw new Error("Campaign ID is required");
  }

  // 6. Create JobRun and update task
  const jobRunApi = new JobRunAPIService({ jwt: state.jwt });

  const jobRun = await jobRunApi.create({
    jobClass: "CampaignEnable",
    arguments: { campaign_id: state.campaignId },
    threadId: state.threadId,
    ...(state.deployId && { deployId: state.deployId }),
  });

  // Create or update task with jobId
  const updatedTask: Task.Task = task
    ? {
        ...task,
        jobId: jobRun.id,
      }
    : {
        ...Deploy.createTask(TASK_NAME),
        status: "running",
        jobId: jobRun.id,
      };

  return withPhases(state, [updatedTask], [TASK_NAME]);
};

/**
 * Enable Campaign Task Runner
 *
 * Enables the Google Ads campaign for serving.
 */
export const enableCampaignTaskRunner: TaskRunner = {
  taskName: TASK_NAME,

  readyToRun: (state: DeployGraphState) => {
    // Ready when CheckingBilling is done
    return isTaskDone(state, "CheckingBilling");
  },

  shouldSkip: (state: DeployGraphState) => {
    // Skip if not deploying Google Ads
    // (executor handles already-completed tasks)
    return !Deploy.shouldDeployGoogleAds(state);
  },

  isBlocking: (state: DeployGraphState, task: Task.Task) => {
    // Blocking when we have a jobId but no result yet
    return (
      task.status === "running" && !!task.jobId && task.result?.enabled === undefined && !task.error
    );
  },

  blockingTimeout: 180_000, // 3 minutes between health checks
  warningTimeout: 120_000, // Show "taking longer than expected" after 2 minutes

  run: enableCampaignNode,
};

// Register this task runner
registerTask(enableCampaignTaskRunner);
