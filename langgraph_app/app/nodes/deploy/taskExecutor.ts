import { type DeployGraphState, withPhases } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Deploy, Task } from "@types";
import { TASK_ORDER, getTaskRunner } from "./taskRunner";
import { NodeMiddleware } from "@middleware";
import { getLogger } from "@core";
import { DeployAPIService, JobRunAPIService } from "@rails_api";

const MAX_TIMEOUT_EXTENSIONS = 2; // max extensions when blockingTimeout is set

type NextTask = {
  taskName: Deploy.TaskName;
  blocking: boolean;
  timedOut: boolean;
  shouldSkip: boolean;
  readyToRun: boolean;
};

const getFailedTask = (state: Partial<DeployGraphState>): Deploy.Task | undefined => {
  return state.tasks?.find((t) => {
    const runner = getTaskRunner(t.name as Deploy.TaskName);
    return t.status === "failed" && !runner?.isFailureRecoverable;
  });
};

const anyTaskFailed = (state: Partial<DeployGraphState>): boolean => {
  return getFailedTask(state) !== undefined;
};

/**
 * Find the next task to process.
 * Returns null if all tasks are done or we hit a fatal failure.
 */
async function findNextTask(state: DeployGraphState): Promise<NextTask | null> {
  const log = getLogger({ component: "taskExecutor.findNextTask" });
  // Build effective task list: respect contentChanged to exclude unchanged parts.
  // This mirrors initPhasesNode's logic so we don't process tasks that were never created.
  const effectiveInstructions: Deploy.Instructions = {};
  if (Deploy.shouldDeployWebsite(state)) effectiveInstructions.website = true;
  if (Deploy.shouldDeployGoogleAds(state)) effectiveInstructions.googleAds = true;
  const tasks = Deploy.findTasks(effectiveInstructions);

  log.debug(
    {
      taskOrder: tasks,
      existingTasks: state.tasks?.map((t) => ({ name: t.name, status: t.status })),
    },
    "Scanning task order for next task"
  );

  for (const taskName of tasks) {
    const task = Task.findTask(state.tasks, taskName);
    const runner = getTaskRunner(taskName);
    if (!runner) {
      log.warn({ taskName }, "No runner registered for task, skipping");
      continue;
    }

    // Skip completed/skipped
    if (task?.status === "completed" || task?.status === "skipped") {
      log.debug({ taskName, status: task.status }, "Task already done, continuing");
      continue;
    }

    // Failed task - check if recoverable
    if (task?.status === "failed") {
      if (runner.isFailureRecoverable) {
        log.info({ taskName, error: task.error }, "Task failed but recoverable, skipping past it");
        continue;
      }
      log.error(
        { taskName, error: task.error },
        "Task failed with non-recoverable error — halting"
      );
      return null;
    }

    // Running task - check if blocking and if timed out
    if (task?.status === "running") {
      const blocking = runner.isBlocking?.(state, task) ?? false;
      let timedOut = false;

      // Only check timeout when runner explicitly sets blockingTimeout.
      // User-managed tasks (ConnectingGoogle, VerifyingGoogle, CheckingBilling)
      // don't set blockingTimeout and wait indefinitely for webhook.
      if (blocking && task.blockingStartedAt && runner.blockingTimeout != null) {
        const elapsed = Date.now() - task.blockingStartedAt;
        timedOut = elapsed > runner.blockingTimeout;
        log.info(
          {
            taskName,
            blocking,
            timedOut,
            elapsed,
            timeout: runner.blockingTimeout,
            jobId: task.jobId,
          },
          "Task is blocking — checking timeout"
        );
      } else {
        log.info(
          { taskName, blocking, jobId: task.jobId, hasResult: !!task.result },
          "Task is running"
        );
      }

      return { taskName, blocking, timedOut, shouldSkip: false, readyToRun: !blocking };
    }

    // New task - check shouldSkip and readyToRun
    const shouldSkip = await runner.shouldSkip(state);
    const readyToRun = runner.readyToRun ? await runner.readyToRun(state) : true;

    log.info(
      { taskName, shouldSkip, readyToRun, currentStatus: task?.status ?? "not-created" },
      "Evaluated next candidate task"
    );
    return { taskName, blocking: false, timedOut: false, shouldSkip, readyToRun };
  }

  log.info("All tasks in task order have been processed");
  return null; // All done
}

/**
 * Check if all tasks are complete (or skipped)
 */
function allTasksComplete(state: DeployGraphState): boolean {
  for (const taskName of TASK_ORDER) {
    const task = Task.findTask(state.tasks, taskName);
    const runner = getTaskRunner(taskName);
    if (!runner) continue;

    // If task exists and is done, continue
    if (task?.status === "completed" || task?.status === "skipped") {
      continue;
    }

    // If task doesn't exist in state.tasks, it was intentionally excluded
    // by initPhasesNode (e.g. contentChanged filtered it out). Treat as done.
    if (!task) {
      continue;
    }

    // Any other status means not complete
    return false;
  }
  return true;
}

/**
 * Check Rails for the actual job run status (fallback when webhook hasn't arrived).
 * Returns the job status if reachable, or null if the check fails.
 */
async function checkJobRunStatus(
  jobId: number,
  jwt: string
): Promise<{
  status: string;
  result: Record<string, unknown> | null;
  error: string | null;
} | null> {
  const log = getLogger({ component: "taskExecutor.checkJobRunStatus" });
  try {
    const api = new JobRunAPIService({ jwt });
    const jobRun = await api.show(jobId);
    log.info({ jobId, status: jobRun.status }, "Job run status check succeeded");
    return jobRun;
  } catch (err) {
    log.warn({ jobId, error: err }, "Job run status check failed — will continue with timeout");
    return null;
  }
}

/**
 * Sync terminal deploy status back to Rails so page reloads show the correct screen.
 * For failures, optionally passes needs_support + error to trigger auto-support-ticket creation.
 * Returns the support ticket reference if one was created.
 */
async function syncDeployStatus(
  state: DeployGraphState,
  status: "completed" | "failed",
  errorMessage?: string,
  node?: string
): Promise<{ supportTicket?: string }> {
  const log = getLogger({ component: "taskExecutor.syncDeployStatus" });
  if (!state.deployId || !state.jwt) {
    log.warn({ deployId: state.deployId }, "Cannot sync deploy status — missing deployId or jwt");
    return {};
  }
  try {
    const api = new DeployAPIService({ jwt: state.jwt });
    const needsSupport = status === "failed" && Deploy.needsSupportTicket(errorMessage, node);
    const result = await api.update(state.deployId as number, {
      status,
      is_live: status === "completed",
      ...(needsSupport && { needs_support: true }),
      ...(errorMessage && { stacktrace: errorMessage }),
    });
    log.info(
      { deployId: state.deployId, status, supportTicket: result.support_ticket },
      "Synced deploy status to Rails"
    );
    return { supportTicket: result.support_ticket ?? undefined };
  } catch (err) {
    // Non-critical — frontend falls back to langgraph state
    log.error({ error: err }, "Failed to sync deploy status to Rails");
    return {};
  }
}

/**
 * Task Executor Node - Raw Function
 */
async function runTaskExecutor(
  state: DeployGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<DeployGraphState>> {
  const log = getLogger({ component: "taskExecutor" });

  log.info(
    {
      deployId: state.deployId,
      currentStatus: state.status,
      taskSummary: state.tasks?.map((t) => ({ name: t.name, status: t.status })),
    },
    "taskExecutor invoked"
  );

  const nextTask = await findNextTask(state);

  // No next task
  if (!nextTask) {
    if (allTasksComplete(state)) {
      log.info("All tasks complete — marking deploy as completed");
      await syncDeployStatus(state, "completed");
      return { status: "completed" };
    }
    // Fatal failure - find the failed task using runner's isFailureRecoverable
    const failedTask = state.tasks.find((t) => {
      if (t.status !== "failed") return false;
      const runner = getTaskRunner(t.name as Deploy.TaskName);
      return !runner?.isFailureRecoverable;
    });
    log.error(
      { failedTask: failedTask?.name, error: failedTask?.error },
      "No next task and not all complete — fatal failure"
    );
    const errorMsg = failedTask?.error ?? "Task failed";
    const failedNode = failedTask?.name ?? "unknown";
    const { supportTicket } = await syncDeployStatus(state, "failed", errorMsg, failedNode);
    return {
      ...withPhases(state, []),
      status: "failed",
      error: { message: errorMsg, node: failedNode },
      supportTicket,
    };
  }

  // Blocking - check timeout or set blockingStartedAt
  if (nextTask.blocking) {
    const task = Task.findTask(state.tasks, nextTask.taskName)!;

    // Timed out — check Rails for actual status before failing
    if (nextTask.timedOut) {
      // Fallback: maybe the job completed but the webhook failed to deliver
      if (task.jobId && state.jwt) {
        const jobStatus = await checkJobRunStatus(task.jobId, state.jwt);
        if (jobStatus) {
          if (jobStatus.status === "completed" && jobStatus.result) {
            log.info(
              { taskName: nextTask.taskName, jobId: task.jobId },
              "Job completed in Rails but webhook missed — recovering from status check"
            );
            return {
              tasks: [{ ...task, result: jobStatus.result, blockingStartedAt: undefined }],
            };
          }
          if (jobStatus.status === "failed") {
            log.info(
              { taskName: nextTask.taskName, jobId: task.jobId },
              "Job failed in Rails — propagating error from status check"
            );
            return {
              tasks: [
                { ...task, error: jobStatus.error ?? "Job failed", blockingStartedAt: undefined },
              ],
            };
          }
          // Job still running in Rails — extend timeout if extensions remain
          if (jobStatus.status === "running" || jobStatus.status === "pending") {
            const extensions = task.timeoutExtensionCount ?? 0;
            if (extensions >= MAX_TIMEOUT_EXTENSIONS) {
              log.warn(
                { taskName: nextTask.taskName, jobId: task.jobId, extensions },
                "Timeout extensions exhausted — falling through to timeout failure"
              );
              // Fall through to timeout failure below
            } else {
              log.info(
                {
                  taskName: nextTask.taskName,
                  jobId: task.jobId,
                  railsStatus: jobStatus.status,
                  extensions: extensions + 1,
                },
                "Job still in progress in Rails — extending timeout"
              );
              return {
                tasks: [
                  { ...task, blockingStartedAt: Date.now(), timeoutExtensionCount: extensions + 1 },
                ],
              };
            }
          }
        }
      }

      // Status check failed or no jobId — proceed with timeout failure
      const runner = getTaskRunner(nextTask.taskName);
      const timeoutError = `Task "${nextTask.taskName}" timed out waiting for external result`;
      log.error({ taskName: nextTask.taskName, jobId: task.jobId }, timeoutError);

      const failedTask = { ...task, status: "failed" as const, error: timeoutError };

      if (runner?.isFailureRecoverable) {
        log.info(
          { taskName: nextTask.taskName },
          "Timed-out task is recoverable, skipping past it"
        );
        return {
          tasks: [failedTask],
        };
      }

      const { supportTicket } = await syncDeployStatus(
        state,
        "failed",
        timeoutError,
        nextTask.taskName
      );
      return {
        ...withPhases(state, [failedTask]),
        status: "failed",
        error: { message: timeoutError, node: nextTask.taskName },
        tasks: [failedTask],
        supportTicket,
      };
    }

    // First time blocking — record blockingStartedAt
    if (!task.blockingStartedAt) {
      log.info(
        { taskName: nextTask.taskName },
        "Task is blocking for the first time — recording blockingStartedAt"
      );
      return {
        tasks: [{ ...task, blockingStartedAt: Date.now() }],
      };
    }

    // Already has blockingStartedAt and within timeout — check if warning needed
    const runner = getTaskRunner(nextTask.taskName);
    const warningTimeout = runner?.warningTimeout;
    const elapsed = Date.now() - task.blockingStartedAt;

    if (warningTimeout && elapsed > warningTimeout && !task.warning) {
      const taskLabel = Deploy.TaskDescriptionMap[nextTask.taskName] ?? nextTask.taskName;
      log.info(
        { taskName: nextTask.taskName, elapsed, warningTimeout },
        "Task blocking past warning threshold — setting warning"
      );
      return {
        tasks: [{ ...task, warning: `${taskLabel} is taking longer than expected` }],
      };
    }

    log.info(
      { taskName: nextTask.taskName },
      "Task is blocking, waiting for webhook — exiting graph"
    );
    return {};
  }

  // Should skip - mark as skipped
  if (nextTask.shouldSkip) {
    log.info({ taskName: nextTask.taskName }, "Skipping task — marking as skipped");
    return {
      tasks: [{ ...Deploy.createTask(nextTask.taskName), status: "skipped" }],
    };
  }

  // Not ready - wait for dependencies
  if (!nextTask.readyToRun) {
    log.info({ taskName: nextTask.taskName }, "Task not ready — waiting for dependencies");
    return {};
  }

  // Task is ready to run
  const runner = getTaskRunner(nextTask.taskName)!;
  const task = Task.findTask(state.tasks, nextTask.taskName);

  // If task doesn't exist or is pending, enqueue it and RETURN
  // (don't run - executor will loop back)
  if (!task || task.status === "pending") {
    log.info(
      { taskName: nextTask.taskName, previousStatus: task?.status ?? "not-created" },
      "Enqueuing task as running"
    );
    const enqueuedTasks = Deploy.enqueueTask(state.tasks, nextTask.taskName);
    const enqueuedTask = enqueuedTasks.find((t) => t.name === nextTask.taskName)!;
    const phaseResult = withPhases({ tasks: state.tasks }, [enqueuedTask]);
    return {
      tasks: [
        {
          ...enqueuedTask,
          status: "running",
        },
      ],
      phases: phaseResult.phases,
    };
  }

  // Task is running - run it
  try {
    log.info({ taskName: nextTask.taskName }, "Executing task runner");
    const startTime = Date.now();
    const partialGraphState = await runner.run(state, config);
    const durationMs = Date.now() - startTime;

    if (anyTaskFailed(partialGraphState)) {
      const failedTask = getFailedTask(partialGraphState);
      const runner = getTaskRunner(failedTask?.name as Deploy.TaskName);
      log.error(
        {
          taskName: nextTask.taskName,
          failedTask: failedTask?.name,
          error: failedTask?.error,
          durationMs,
          recoverable: !!runner?.isFailureRecoverable,
        },
        "Task runner returned failure"
      );
      if (!runner?.isFailureRecoverable) {
        const errorMsg = failedTask?.error ?? "Task failed";
        const { supportTicket } = await syncDeployStatus(state, "failed", errorMsg);
        const failedTaskUpdate = { ...failedTask, status: "failed" } as Deploy.Task;
        return {
          ...withPhases(state, [failedTaskUpdate]),
          status: "failed",
          error: {
            message: errorMsg,
            node: failedTask?.name ?? "unknown",
          },
          supportTicket,
        };
      }
      return partialGraphState;
    }

    const updatedTasks = partialGraphState.tasks?.map((t) => ({ name: t.name, status: t.status }));
    log.info(
      { taskName: nextTask.taskName, durationMs, updatedTasks },
      "Task runner completed successfully"
    );

    // Sync terminal status to Rails so page reloads show the correct screen.
    // This fires here because task runners (e.g. deployWebsiteNode) can return
    // a terminal status directly, and the graph exits via the router without
    // re-entering the executor's allTasksComplete branch.
    if (partialGraphState.status === "completed" || partialGraphState.status === "failed") {
      const errorMsg =
        partialGraphState.status === "failed"
          ? (partialGraphState.error as any)?.message
          : undefined;
      const { supportTicket } = await syncDeployStatus(state, partialGraphState.status, errorMsg);
      if (supportTicket) {
        return { ...partialGraphState, supportTicket };
      }
    }

    return partialGraphState;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(
      {
        taskName: nextTask.taskName,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Task runner threw an exception"
    );
    const { supportTicket } = await syncDeployStatus(
      state,
      "failed",
      errorMessage,
      nextTask.taskName
    );
    const failedTaskUpdate = { ...task, status: "failed", error: errorMessage } as Deploy.Task;
    return {
      ...withPhases(state, [failedTaskUpdate]),
      status: "failed",
      error: { message: errorMessage, node: nextTask.taskName },
      supportTicket,
    };
  }
}

// Export with middleware (enables test interrupt)
export const taskExecutorNode = NodeMiddleware.use(runTaskExecutor);

/**
 * Router: continue, wait, or end
 */
export async function taskExecutorRouter(
  state: DeployGraphState
): Promise<"continue" | "wait" | "end"> {
  const log = getLogger({ component: "taskExecutorRouter" });

  if (state.error) {
    log.info({ error: state.error }, "Router → end (error present)");
    return "end";
  }

  const nextTask = await findNextTask(state);

  if (!nextTask) {
    log.info(
      { taskSummary: state.tasks?.map((t) => ({ name: t.name, status: t.status })) },
      "Router → end (no next task)"
    );
    return "end";
  }
  if (nextTask.blocking) {
    log.info({ taskName: nextTask.taskName }, "Router → wait (task blocking)");
    return "wait";
  }
  if (!nextTask.readyToRun && !nextTask.shouldSkip) {
    log.info({ taskName: nextTask.taskName }, "Router → wait (task not ready, not skippable)");
    return "wait";
  }

  log.info(
    {
      taskName: nextTask.taskName,
      shouldSkip: nextTask.shouldSkip,
      readyToRun: nextTask.readyToRun,
    },
    "Router → continue"
  );
  return "continue";
}
