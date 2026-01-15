import { type DeployGraphState, withPhases } from "@annotation";
import { JobRunAPIService } from "@rails_api";
import { GoogleAPIService } from "@services";
import { Deploy, Task } from "@types";

const TASK_NAME: Deploy.TaskName = "ConnectingGoogle";

/**
 * Google Connect Node (Idempotent Pattern)
 *
 * This node uses the fire-and-forget + idempotent pattern:
 * 1. First invocation: fires Rails job, creates task with "running" status
 * 2. Subsequent invocations with running task + jobId: returns {} (waiting for callback)
 * 3. When webhook updates task with result: processes result, marks completed
 * 4. When webhook updates task with error: marks failed
 * 5. Already completed/failed: returns {} (no-op)
 *
 * This is a SKIPPABLE task - if Google is already connected,
 * we skip this entirely via conditional routing in the graph.
 */
export const googleConnectNode = async (
  state: DeployGraphState
): Promise<Partial<DeployGraphState>> => {
  const task = Task.findTask(state.tasks, TASK_NAME);

  // 1. Already completed or failed? No-op (idempotent)
  if (task?.status === "completed" || task?.status === "failed") {
    return {};
  }

  // 2. Task running with result from webhook (google_email)? Mark completed
  if (task?.status === "running" && task.result?.google_email) {
    return withPhases(state, [{ ...task, status: "completed" } as Task.Task], [TASK_NAME]);
  }

  // 3. Task running with error from webhook? Mark failed
  if (task?.status === "running" && task.error) {
    return withPhases(state, [{ ...task, status: "failed" } as Task.Task], [TASK_NAME]);
  }

  // 4. Task running with jobId? Waiting for OAuth callback, no-op
  if (task?.status === "running" && task.jobId) {
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
    jobClass: "GoogleOAuthConnect",
    arguments: {},
    threadId: state.threadId,
  });

  // Create or update task with jobId and oauth_required result
  const updatedTask: Task.Task = task
    ? {
        ...task,
        jobId: jobRun.id,
        result: { action: "oauth_required" },
      }
    : {
        ...Deploy.createTask(TASK_NAME),
        status: "running",
        jobId: jobRun.id,
        result: { action: "oauth_required" },
      };

  return withPhases(state, [updatedTask], [TASK_NAME]);
};

/**
 * Check if Google is already connected for this account
 *
 * This function is used by the graph's conditional routing to decide
 * whether to skip the GoogleConnect task entirely.
 *
 * Order of checks:
 * 1. If ConnectingGoogle task is completed, return true (skip)
 * 2. Call Rails API to check if account has google_connected_account
 *
 * @param state - Current graph state
 * @returns true if Google is connected (skip the task), false otherwise
 */
export async function isGoogleConnected(state: DeployGraphState): Promise<boolean> {
  // 1. If task already completed in state, skip
  const task = Task.findTask(state.tasks, TASK_NAME);
  if (task?.status === "completed") {
    return true;
  }

  // 2. Check Rails API for actual connection status
  // Fail-safe: if JWT is missing, return false to proceed with connect flow
  if (!state.jwt) {
    return false;
  }

  const googleApi = new GoogleAPIService({ jwt: state.jwt });
  const { connected } = await googleApi.getConnectionStatus();

  return connected;
}

/**
 * Conditional routing function for skippable Google connect task
 *
 * Usage in graph:
 * ```
 * .addConditionalEdges(START, shouldSkipGoogleConnect, {
 *   skipGoogleConnect: "nextNode",
 *   enqueueGoogleConnect: "enqueueGoogleConnect",
 * })
 * ```
 */
export async function shouldSkipGoogleConnect(
  state: DeployGraphState
): Promise<"skipGoogleConnect" | "enqueueGoogleConnect"> {
  const connected = await isGoogleConnected(state);
  return connected ? "skipGoogleConnect" : "enqueueGoogleConnect";
}
