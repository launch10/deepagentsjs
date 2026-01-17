import { type DeployGraphState, withPhases } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Deploy, Task } from "@types";
import { TASK_ORDER, getTaskRunner } from "./taskRunner";

type NextTask = {
  taskName: Deploy.TaskName;
  blocking: boolean;
  shouldSkip: boolean;
  readyToRun: boolean;
};

/**
 * Find the next task to process.
 * Returns null if all tasks are done or we hit a fatal failure.
 */
async function findNextTask(state: DeployGraphState): Promise<NextTask | null> {
  for (const taskName of TASK_ORDER) {
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
 * Task Executor Node
 */
export async function taskExecutorNode(
  state: DeployGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<DeployGraphState>> {
  const next = await findNextTask(state);

  // No next task
  if (!next) {
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
      status: "failed",
      error: { message: failedTask?.error ?? "Task failed", node: failedTask?.name ?? "unknown" },
    };
  }

  // Blocking - wait for webhook
  if (next.blocking) {
    return {};
  }

  // Should skip - mark as skipped
  if (next.shouldSkip) {
    return {
      tasks: [{ ...Deploy.createTask(next.taskName), status: "skipped" }],
    };
  }

  // Not ready - wait for dependencies
  if (!next.readyToRun) {
    return {};
  }

  // Task is ready to run
  const runner = getTaskRunner(next.taskName)!;
  const task = Task.findTask(state.tasks, next.taskName);

  // If task doesn't exist or is pending, enqueue it and RETURN
  // (don't run - executor will loop back)
  if (!task || task.status === "pending") {
    const enqueuedTasks = Deploy.enqueueTask(state.tasks, next.taskName);
    const enqueuedTask = enqueuedTasks.find((t) => t.name === next.taskName)!;
    const phaseResult = withPhases({ tasks: state.tasks }, [enqueuedTask]);
    return { tasks: [enqueuedTask], phases: phaseResult.phases };
  }

  // Task is running - run it
  try {
    return await runner.run(state, config);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      tasks: [{ ...task, status: "failed", error: errorMessage }],
      status: "failed",
      error: { message: errorMessage, node: "taskExecutor" },
    };
  }
}

/**
 * Router: continue, wait, or end
 */
export async function taskExecutorRouter(
  state: DeployGraphState
): Promise<"continue" | "wait" | "end"> {
  const next = await findNextTask(state);

  if (!next) return "end";
  if (next.blocking) return "wait";
  if (!next.readyToRun && !next.shouldSkip) return "wait";

  return "continue";
}
