import type { DeployGraphState } from "@annotation";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { Deploy, Task } from "@types";

/**
 * TaskRunner Interface
 *
 * Every deploy task implements this interface. The task executor loop
 * calls these methods to determine what to do with each task.
 */
export interface TaskRunner {
  /**
   * The task name (must match Deploy.TaskName)
   */
  taskName: Deploy.TaskName;

  /**
   * Is this task ready to run?
   *
   * Checks if all prerequisites are met. This enables parallelization:
   * tasks with different dependencies can run in parallel when their
   * dependencies are satisfied.
   *
   * Examples:
   * - AddingAnalytics is ready when Google setup is done OR not deploying campaign
   * - OptimizingSEO is ready when deploying website (no dep on AddingAnalytics)
   * - DeployingWebsite is ready when validation is done
   *
   * Default: Always ready (for tasks with no dependencies)
   *
   * @returns true if prerequisites are met
   */
  readyToRun?: (state: DeployGraphState) => Promise<boolean> | boolean;

  /**
   * Should this task be skipped entirely?
   *
   * Called AFTER readyToRun. If true, the task is not needed
   * and we move to the next task immediately.
   *
   * Examples:
   * - Skip GoogleConnect if already connected
   * - Skip GoogleVerify if already verified
   * - Skip Analytics if not deploying website
   *
   * @returns true to skip this task, false to run it
   */
  shouldSkip: (state: DeployGraphState) => Promise<boolean> | boolean;

  /**
   * Is this task blocking (waiting for external completion)?
   *
   * Called when the task is "running". If true, we exit the graph
   * and wait for a webhook/external event to update the task.
   *
   * This is for the fire-and-forget pattern where:
   * 1. First run: Start the job, task becomes "running"
   * 2. Graph exits, waits for webhook
   * 3. Webhook updates task with result/error
   * 4. Graph re-runs, task processes result
   *
   * @returns true if we should wait for external completion
   */
  isBlocking?: (state: DeployGraphState, task: Task.Task) => boolean;

  /**
   * How long (ms) to wait for a blocking task before timing out.
   *
   * Only applies when isBlocking returns true. When exceeded, the executor
   * checks Rails for actual job status. If the job is still running, the
   * timeout is extended (up to MAX_TIMEOUT_EXTENSIONS).
   *
   * If not set, the task blocks indefinitely (no timeout). This is correct
   * for user-managed tasks (ConnectingGoogle, VerifyingGoogle, CheckingBilling)
   * where the user controls when the action completes.
   *
   * Set explicitly for automated jobs (DeployingWebsite, DeployingCampaign,
   * EnableCampaign) where a stuck job should trigger a health check.
   */
  blockingTimeout?: number;

  /**
   * How long (ms) before showing a user-facing "taking longer than expected" warning.
   *
   * This is a concrete per-task threshold (not a percentage of blockingTimeout).
   * Only applies when isBlocking returns true. If not set, no warning is shown.
   *
   * Example: Website deploy warns at 2 minutes (120_000).
   */
  warningTimeout?: number;

  /**
   * Can we recover from this task's failure?
   *
   * Default: false (failure is fatal, stops the graph)
   *
   * If true, we skip this task on failure and continue.
   * Used for validation tasks where bugfix can handle the error.
   */
  isFailureRecoverable?: boolean;

  /**
   * Execute the task
   *
   * This is the main task logic. It should:
   * 1. Check if already completed (idempotent)
   * 2. Do the work
   * 3. Return state updates
   *
   * @returns Partial state updates
   */
  run: (
    state: DeployGraphState,
    config?: LangGraphRunnableConfig
  ) => Promise<Partial<DeployGraphState>>;
}

/**
 * Task Order
 *
 * This defines the iteration order for finding ready tasks.
 * Tasks can run out of this order if their readyToRun returns true
 * before earlier tasks complete.
 *
 * Notes:
 * - Google tasks are at the start (needed before website deploy for google_send_to)
 * - Website tasks run for all deploys
 * - Campaign tasks only run when deploying Google Ads
 */
export const TASK_ORDER = Deploy.TASK_ORDER;

/**
 * Helper: Is task completed or skipped?
 *
 * A task is "done" if it's completed or if it's been marked as skipped.
 * Used for checking if dependencies are satisfied.
 */
export function isTaskDone(state: DeployGraphState, taskName: Deploy.TaskName): boolean {
  if (!Deploy.isTaskRequired(state.instructions, taskName)) {
    return true;
  }
  const task = Task.findTask(state.tasks, taskName);
  return !!task && (task.status === "completed" || task.status === "skipped");
}

/**
 * Helper: Is task running?
 */
export function isTaskRunning(state: DeployGraphState, taskName: Deploy.TaskName): boolean {
  const task = Task.findTask(state.tasks, taskName);
  return task?.status === "running";
}

/**
 * Helper: Did task fail?
 */
export function isTaskFailed(state: DeployGraphState, taskName: Deploy.TaskName): boolean {
  const task = Task.findTask(state.tasks, taskName);
  return !!task && task?.status === "failed";
}

/**
 * Get task runner for a task name
 *
 * This is populated by registerTask() calls from each node file
 */
const taskRegistry = new Map<Deploy.TaskName, TaskRunner>();

export function registerTask(runner: TaskRunner): void {
  taskRegistry.set(runner.taskName, runner);
}

export function getTaskRunner(taskName: Deploy.TaskName): TaskRunner | undefined {
  return taskRegistry.get(taskName);
}

export function getAllTaskRunners(): Map<Deploy.TaskName, TaskRunner> {
  return taskRegistry;
}
