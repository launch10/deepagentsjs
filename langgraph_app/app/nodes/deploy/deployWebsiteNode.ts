import { type DeployGraphState, withPhases } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { JobRunAPIService } from "@services";
import { Deploy, Task } from "@types";
import { type TaskRunner, registerTask, isTaskDone } from "./taskRunner";

const TASK_NAME: Deploy.TaskName = "DeployingWebsite";

/**
 * Deploy Website - Raw Function (Idempotent Pattern)
 *
 * Uses the fire-and-forget + idempotent pattern:
 * 1. First invocation: fires Rails job, creates task with "pending" status
 * 2. Subsequent invocations with pending/running task: returns {} (no-op)
 * 3. When webhook updates task with result: processes result, marks completed
 * 4. Already completed/failed: returns {} (no-op)
 */
async function runDeployWebsite(
  state: DeployGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<DeployGraphState>> {
  const task = Task.findTask(state.tasks, TASK_NAME);

  if (!task) {
    throw new Error("DeployingWebsite task not found");
  }

  // 1. If task is not running, we're done
  if (task?.status !== "running") {
    return {};
  }

  // 2. Did webhook return us a result? Mark task completed (not graph-level — taskExecutor handles that)
  if (task?.result) {
    return withPhases(
      state,
      [{ ...task, status: "completed" } as Task.Task],
      [TASK_NAME as Deploy.PhaseName]
    );
  }

  // 3. Did webhook return us an error? Mark task failed (not graph-level — taskExecutor handles that)
  if (task.error !== undefined) {
    return withPhases(
      state,
      [{ ...task, status: "failed" } as Task.Task],
      [TASK_NAME as Deploy.PhaseName]
    );
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

// Legacy export with middleware
export const deployWebsiteNode = NodeMiddleware.use({}, runDeployWebsite);

/**
 * Deploy Website Task Runner
 *
 * Deploys the website using fire-and-forget pattern.
 */
export const deployWebsiteTaskRunner: TaskRunner = {
  taskName: TASK_NAME,

  readyToRun: (state: DeployGraphState) => {
    // Ready when AddingAnalytics is done (last prep step before deploy)
    return isTaskDone(state, "AddingAnalytics");
  },

  shouldSkip: (state: DeployGraphState) => {
    // Skip if not deploying a website (or content unchanged)
    // (executor handles already-completed tasks)
    return !Deploy.shouldDeployWebsite(state);
  },

  isBlocking: (state: DeployGraphState, task: Task.Task) => {
    // Blocking when we have a jobId but no result yet
    return task.status === "running" && !!task.jobId && !task.result && !task.error;
  },

  blockingTimeout: 180_000, // 3 minutes between health checks
  warningTimeout: 120_000, // Show "taking longer than expected" after 2 minutes

  run: runDeployWebsite,
};

// Register this task runner
registerTask(deployWebsiteTaskRunner);
