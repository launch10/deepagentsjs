import { type DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { JobRunAPIService } from "@services";
import { Deploy, Task } from "@types";
import { type TaskRunner, registerTask } from "./taskRunner";

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

  // 2. Did webhook return us a result? We're done.
  if (task?.result) {
    return {
      tasks: Task.updateTask(state.tasks, TASK_NAME, { status: "completed" }),
      status: "completed",
      result: task.result,
    };
  }

  // 3. Did webhook return us an error? We're done.
  if (task.error) {
    return {
      tasks: Task.updateTask(state.tasks, TASK_NAME, { status: "failed" }),
      status: "failed",
      error: { message: task.error, node: "deployWebsiteNode" },
    };
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
    // Ready when RuntimeValidation is done (or if bugfix ran)
    // We only deploy if validation passed
    const runtimeTask = Task.findTask(state.tasks, "RuntimeValidation");
    const bugFixTask = Task.findTask(state.tasks, "FixingBugs");

    return (runtimeTask?.status === "completed" || bugFixTask?.status === "completed")
  },

  shouldSkip: (state: DeployGraphState) => {
    // Skip if not deploying a website
    // (executor handles already-completed tasks)
    return !state.deploy?.website;
  },

  isBlocking: (state: DeployGraphState, task: Task.Task) => {
    // Blocking when we have a jobId but no result yet
    return task.status === "running" && !!task.jobId && !task.result && !task.error;
  },

  run: runDeployWebsite,
};

// Register this task runner
registerTask(deployWebsiteTaskRunner);
