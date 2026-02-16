import { type DeployGraphState, withPhases } from "@annotation";
import { JobRunAPIService } from "@rails_api";
import { GoogleAPIService } from "@services";
import { Deploy, Task } from "@types";
import { type TaskRunner, registerTask } from "./taskRunner";

const TASK_NAME: Deploy.TaskName = "ConnectingGoogle";

/**
 * Check if Google is already connected for this account
 */
export async function isGoogleConnected(state: DeployGraphState): Promise<boolean> {
  // Check Rails API for actual connection status
  // (executor handles task completion state)
  if (!state.jwt) {
    return false;
  }

  const googleApi = new GoogleAPIService({ jwt: state.jwt });
  const { connected } = await googleApi.getConnectionStatus();

  return connected;
}

/**
 * Google Connect Task Runner
 *
 * Uses the fire-and-forget + idempotent pattern:
 * 1. First invocation: fires Rails job, creates task with "running" status
 * 2. isBlocking returns true when waiting for OAuth callback
 * 3. When webhook updates task with result: processes result, marks completed
 */
export const googleConnectTaskRunner: TaskRunner = {
  taskName: TASK_NAME,

  // Always ready - first task for Google Ads flow
  readyToRun: () => true,

  shouldSkip: async (state: DeployGraphState) => {
    // Skip if not deploying Google Ads
    if (!Deploy.shouldDeployGoogleAds(state)) {
      return true;
    }

    // Skip if already connected
    return isGoogleConnected(state);
  },

  isBlocking: (state: DeployGraphState, task: Task.Task) => {
    // Blocking when we have a jobId but no result yet
    return task.status === "running" && !!task.jobId && !task.result?.google_email && !task.error;
  },

  run: async (state: DeployGraphState): Promise<Partial<DeployGraphState>> => {
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

    // 4. Self-heal: task running with jobId but no result?
    //    Check if Google is already connected (OAuth callback may have missed the job)
    if (task?.status === "running" && task.jobId && !task.result?.google_email && !task.error) {
      if (await isGoogleConnected(state)) {
        return withPhases(state, [{ ...task, status: "completed", result: { google_email: "connected" } } as Task.Task], [TASK_NAME]);
      }
      // Not connected yet — fall through to no-op (isBlocking will exit graph)
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
  },
};

// Register this task runner
registerTask(googleConnectTaskRunner);

// Legacy exports for backwards compatibility
export const googleConnectNode = googleConnectTaskRunner.run;