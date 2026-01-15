import { type DeployGraphState, withPhases } from "@annotation";
import { JobRunAPIService } from "@rails_api";
import { GoogleAPIService, DeployService } from "@services";
import { Deploy, Task } from "@types";

const TASK_NAME: Deploy.TaskName = "CheckingBilling";

/**
 * Check Payment Node (Idempotent Pattern)
 *
 * This node handles the Google Ads payment/billing verification flow:
 * 1. First invocation: fires Rails job to check payment status
 * 2. Subsequent invocations with running task + jobId: returns {} (waiting for webhook)
 * 3. When webhook updates task with result: marks completed
 * 4. When webhook updates task with error: marks failed
 * 5. Already completed/failed: returns {} (no-op)
 *
 * This is a SKIPPABLE task - if payment is already verified,
 * we skip this entirely via conditional routing in the graph.
 */
export const checkPaymentNode = async (
  state: DeployGraphState
): Promise<Partial<DeployGraphState>> => {
  const task = Task.findTask(state.tasks, TASK_NAME);

  // 1. Already completed or failed? No-op (idempotent)
  if (task?.status === "completed" || task?.status === "failed") {
    return {};
  }

  // 2. Task running with result from webhook (has_payment)? Mark completed
  if (task?.status === "running" && task.result?.has_payment !== undefined) {
    return withPhases(state, [{ ...task, status: "completed" } as Task.Task], [TASK_NAME]);
  }

  // 3. Task running with error from webhook? Mark failed
  if (task?.status === "running" && task.error) {
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

  // 6. Create JobRun and update task
  const jobRunApi = new JobRunAPIService({ jwt: state.jwt });

  const jobRun = await jobRunApi.create({
    jobClass: "GoogleAdsPaymentCheck",
    arguments: {},
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
 * Check if Google Ads payment is already verified for this account
 *
 * This function is used by the graph's conditional routing to decide
 * whether to skip the CheckingBilling task entirely.
 *
 * Order of checks:
 * 1. If CheckingBilling task is completed, return true (skip)
 * 2. Call Rails API to check if payment is verified
 *
 * @param state - Current graph state
 * @returns true if payment is verified (skip the task), false otherwise
 */
export async function isPaymentVerified(state: DeployGraphState): Promise<boolean> {
  // 1. If task already completed in state, skip
  const task = Task.findTask(state.tasks, TASK_NAME);
  if (task?.status === "completed") {
    return true;
  }

  // 2. Check Rails API for actual payment status
  if (!state.jwt) {
    return false;
  }

  const googleApi = new GoogleAPIService({ jwt: state.jwt });
  const { has_payment } = await googleApi.getPaymentStatus();

  return has_payment;
}

/**
 * Conditional routing function for skippable payment check task
 *
 * Usage in graph:
 * ```
 * .addConditionalEdges("checkPaymentStatus", shouldCheckPayment, {
 *   skipCheckPayment: "enableCampaign",
 *   checkPayment: "checkPayment",
 * })
 * ```
 */
export async function shouldCheckPayment(
  state: DeployGraphState
): Promise<"skipCheckPayment" | "checkPayment"> {
  const verified = await isPaymentVerified(state);
  return verified ? "skipCheckPayment" : "checkPayment";
}
