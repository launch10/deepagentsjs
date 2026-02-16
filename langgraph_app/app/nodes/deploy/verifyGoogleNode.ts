import { type DeployGraphState, withPhases } from "@annotation";
import { JobRunAPIService } from "@rails_api";
import { GoogleAPIService, DeployService } from "@services";
import { Deploy, Task } from "@types";
import { type TaskRunner, registerTask, isTaskDone } from "./taskRunner";

const TASK_NAME: Deploy.TaskName = "VerifyingGoogle";

/**
 * Verify Google Node (Idempotent Pattern)
 *
 * This node handles the Google Ads invite verification flow:
 * 1. First invocation: fires Rails job to send invite and start polling
 * 2. Subsequent invocations with running task + jobId: returns {} (waiting for polling)
 * 3. When webhook updates task with result (accepted): marks completed
 * 4. When webhook updates task with error: marks failed
 * 5. Already completed/failed: returns {} (no-op)
 *
 * This is a SKIPPABLE task - if the invite is already accepted,
 * we skip this entirely via conditional routing in the graph.
 */
export const verifyGoogleNode = async (
  state: DeployGraphState
): Promise<Partial<DeployGraphState>> => {
  const task = Task.findTask(state.tasks, TASK_NAME);

  // 1. Already completed or failed? No-op (idempotent)
  if (task?.status === "completed" || task?.status === "failed") {
    return {};
  }

  // 2. Task running with result from webhook (status: accepted)? Mark completed
  if (task?.status === "running" && task.result?.status === "accepted") {
    return withPhases(state, [{ ...task, status: "completed" } as Task.Task], [TASK_NAME]);
  }

  // 3. Task running with error from webhook? Mark failed
  if (task?.status === "running" && task.error) {
    return withPhases(state, [{ ...task, status: "failed" } as Task.Task], [TASK_NAME]);
  }

  // 4. Self-heal: task running with jobId but no result?
  //    Live-refresh invite status from Google. If accepted, complete immediately.
  //    If not, Rails enqueues PollInviteAcceptanceWorker for a quick follow-up.
  if (task?.status === "running" && task.jobId && !task.result?.status && !task.error) {
    if (state.deployId) {
      DeployService.touch(state.deployId).catch(() => {});
    }

    if (state.jwt) {
      const googleApi = new GoogleAPIService({ jwt: state.jwt });
      const { accepted } = await googleApi.refreshInviteStatus(task.jobId);

      if (accepted) {
        return withPhases(state, [{ ...task, status: "completed", result: { status: "accepted" } } as Task.Task], [TASK_NAME]);
      }
    }

    // Not accepted yet — async worker enqueued by Rails for quick follow-up.
    // Fall through to no-op (isBlocking will exit graph)
    return {};
  }

  // 5. Validate required fields before creating JobRun
  if (!state.jwt) {
    throw new Error("JWT token is required for API authentication");
  }
  if (!state.threadId) {
    throw new Error("Thread ID is required");
  }

  // 6. Create JobRun and update task
  const jobRunApi = new JobRunAPIService({ jwt: state.jwt });

  const jobRun = await jobRunApi.create({
    jobClass: "GoogleAdsInvite",
    arguments: {},
    threadId: state.threadId,
    // Link to deploy for user activity tracking (batch scheduler uses this)
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
 * Check if Google Ads invite is already accepted for this account
 *
 * This function is used by the graph's conditional routing to decide
 * whether to skip the VerifyGoogle task entirely.
 *
 * Order of checks:
 * 1. If VerifyingGoogle task is completed, return true (skip)
 * 2. Call Rails API to check if invite is accepted
 *
 * @param state - Current graph state
 * @returns true if invite is accepted (skip the task), false otherwise
 */
export async function isGoogleVerified(state: DeployGraphState): Promise<boolean> {
  // Check Rails API for actual invite status
  // (executor handles task completion state)
  if (!state.jwt) {
    return false;
  }

  const googleApi = new GoogleAPIService({ jwt: state.jwt });
  const { accepted } = await googleApi.getInviteStatus();

  return accepted;
}

/**
 * Conditional routing function for skippable Google verify task
 *
 * Usage in graph:
 * ```
 * .addConditionalEdges("checkGoogleVerify", shouldSkipGoogleVerify, {
 *   skipGoogleVerify: "enqueueDeployCampaign",
 *   enqueueGoogleVerify: "enqueueGoogleVerify",
 * })
 * ```
 */
export async function shouldSkipGoogleVerify(
  state: DeployGraphState
): Promise<"skipGoogleVerify" | "enqueueGoogleVerify"> {
  const verified = await isGoogleVerified(state);
  return verified ? "skipGoogleVerify" : "enqueueGoogleVerify";
}

/**
 * Verify Google Task Runner
 *
 * Handles the Google Ads invite verification flow using fire-and-forget pattern.
 */
export const verifyGoogleTaskRunner: TaskRunner = {
  taskName: TASK_NAME,

  readyToRun: (state: DeployGraphState) => {
    // Ready when ConnectingGoogle is completed or skipped
    return isTaskDone(state, "ConnectingGoogle");
  },

  shouldSkip: async (state: DeployGraphState) => {
    // Skip if not deploying Google Ads
    if (!Deploy.shouldDeployGoogleAds(state)) {
      return true;
    }

    // Skip if already verified
    return isGoogleVerified(state);
  },

  isBlocking: (state: DeployGraphState, task: Task.Task) => {
    // Blocking when we have a jobId but no result yet
    return task.status === "running" && !!task.jobId && !task.result?.status && !task.error;
  },

  run: verifyGoogleNode,
};

// Register this task runner
registerTask(verifyGoogleTaskRunner);