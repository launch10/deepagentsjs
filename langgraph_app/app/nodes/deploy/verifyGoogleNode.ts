import { type DeployGraphState, withPhases } from "@annotation";
import { JobRunAPIService } from "@rails_api";
import { GoogleAPIService, DeployService } from "@services";
import { Deploy, Task } from "@types";

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

  // 4. Task running with jobId? Waiting for polling to complete
  //    Touch the deploy to indicate user is still active (for batch scheduler)
  if (task?.status === "running" && task.jobId) {
    if (state.deployId) {
      // Fire-and-forget: write directly to DB, don't wait or fail if it errors
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
  // 1. If task already completed in state, skip
  const task = Task.findTask(state.tasks, TASK_NAME);
  if (task?.status === "completed") {
    return true;
  }

  // 2. Check Rails API for actual invite status
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
