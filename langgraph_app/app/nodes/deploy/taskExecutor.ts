import { type DeployGraphState, withPhases } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Deploy, Task } from "@types";
import { TASK_ORDER, getTaskRunner } from "./taskRunner";
import { NodeMiddleware } from "@middleware";
import { getLogger } from "@core";

type NextTask = {
  taskName: Deploy.TaskName;
  blocking: boolean;
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
  const tasks = Deploy.findTasks(state.deploy); // Returns tasks based on instructions, in order of execution

  for (const taskName of tasks) {
    const task = Task.findTask(state.tasks, taskName);
    const runner = getTaskRunner(taskName);
    if (!runner) continue;

    // Skip completed/skipped
    if (task?.status === "completed" || task?.status === "skipped") {
      continue;
    }

    // Failed task - check if recoverable
    if (task?.status === "failed") {
      if (runner.isFailureRecoverable) {
        // Recoverable failure - skip and continue
        continue;
      }
      // Non-recoverable failure = fatal
      return null;
    }

    // Running task - check if blocking
    if (task?.status === "running") {
      const blocking = runner.isBlocking?.(state, task) ?? false;
      return { taskName, blocking, shouldSkip: false, readyToRun: !blocking };
    }

    // New task - check shouldSkip and readyToRun
    const shouldSkip = await runner.shouldSkip(state);
    const readyToRun = runner.readyToRun ? await runner.readyToRun(state) : true;

    return { taskName, blocking: false, shouldSkip, readyToRun };
  }

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

    // If task doesn't exist, check if it should be skipped
    // (we can't call shouldSkip here without async, so assume not done)
    if (!task) {
      return false;
    }

    // Any other status means not complete
    return false;
  }
  return true;
}

/**
 * Task Executor Node - Raw Function
 */
async function runTaskExecutor(
  state: DeployGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<DeployGraphState>> {
  const nextTask = await findNextTask(state);

  // No next task
  if (!nextTask) {
    getLogger().info("No next task found");
    if (allTasksComplete(state)) {
      return { status: "completed" };
    }
    // Fatal failure - find the failed task using runner's isFailureRecoverable
    const failedTask = state.tasks.find((t) => {
      if (t.status !== "failed") return false;
      const runner = getTaskRunner(t.name as Deploy.TaskName);
      return !runner?.isFailureRecoverable;
    });
    return {
      ...withPhases(state, []),
      status: "failed",
      error: { message: failedTask?.error ?? "Task failed", node: failedTask?.name ?? "unknown" },
    };
  }

  // Blocking - wait for webhook
  if (nextTask.blocking) {
    getLogger().info({ taskName: nextTask.taskName }, "Task is blocking, waiting for webhook");
    return {};
  }

  // Should skip - mark as skipped
  if (nextTask.shouldSkip) {
    getLogger().info({ taskName: nextTask.taskName }, "Skipping task");
    return {
      tasks: [{ ...Deploy.createTask(nextTask.taskName), status: "skipped" }],
    };
  }

  // Not ready - wait for dependencies
  if (!nextTask.readyToRun) {
    return {};
  }

  // Task is ready to run
  const runner = getTaskRunner(nextTask.taskName)!;
  const task = Task.findTask(state.tasks, nextTask.taskName);

  // If task doesn't exist or is pending, enqueue it and RETURN
  // (don't run - executor will loop back)
  if (!task || task.status === "pending") {
    getLogger().info({ taskName: nextTask.taskName }, "Enqueuing task");
    const enqueuedTasks = Deploy.enqueueTask(state.tasks, nextTask.taskName);
    const enqueuedTask = enqueuedTasks.find((t) => t.name === nextTask.taskName)!;
    const phaseResult = withPhases({ tasks: state.tasks }, [enqueuedTask]);
    return { tasks: [{
      ...enqueuedTask,
      status: "running"
    }], phases: phaseResult.phases };
  }

  // Task is running - run it
  try {
    getLogger().info({ taskName: nextTask.taskName }, "Running task");
    const partialGraphState = await runner.run(state, config);
    if (anyTaskFailed(partialGraphState)) {
      const failedTask = getFailedTask(partialGraphState)
      const runner = getTaskRunner(failedTask?.name as Deploy.TaskName);
      if (!runner?.isFailureRecoverable) {
        const failedTaskUpdate = { ...failedTask, status: "failed" } as Deploy.Task;
        return {
          ...withPhases(state, [failedTaskUpdate]),
          status: "failed",
          error: { message: failedTask?.error ?? "Task failed", node: failedTask?.name ?? "unknown" },
        };
      }
      return partialGraphState;
    }
    return partialGraphState;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const failedTaskUpdate = { ...task, status: "failed", error: errorMessage } as Deploy.Task;
    return {
      ...withPhases(state, [failedTaskUpdate]),
      status: "failed",
      error: { message: errorMessage, node: "taskExecutor" },
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
  if (state.error) return "end";

  const nextTask = await findNextTask(state);

  if (!nextTask) {
    getLogger().info("No next task, ending");
    return "end";
  }
  if (nextTask.blocking) {
    getLogger().info({ taskName: nextTask.taskName }, "Task blocking, waiting");
    return "wait";
  }
  if (!nextTask.readyToRun && !nextTask.shouldSkip) {
    getLogger().info({ taskName: nextTask.taskName }, "Task not ready to run, waiting");
    return "wait";
  }

  return "continue";
}
