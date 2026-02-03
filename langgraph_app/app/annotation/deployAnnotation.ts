import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { Deploy } from "@types";
import type { PrimaryKeyType, Task, ConsoleError, ShowMismatches, Expect, Equal } from "@types";
import { createAppBridge } from "@api/middleware";

export const DeployAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  // Rails Deploy record ID (for linking job_runs, user activity tracking)
  deployId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),

  // Final deploy status for frontend
  status: Annotation<Deploy.Status | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  // Deploy result from the job
  result: Annotation<Record<string, unknown> | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  // Boolean flags for what to deploy
  deploy: Annotation<Deploy.Instructions>({
    default: () => ({}),
    reducer: (current, next) => next ?? current,
  }),

  // IDs (websiteId already in BaseAnnotation)
  campaignId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),
  consoleErrors: Annotation<ConsoleError[]>({
    default: () => [],
    reducer: (current, next) => next,
  }),

  // Task tracking - ALL state lives here
  tasks: Annotation<Task.Task[]>({
    default: () => [],
    reducer: (current, next) => {
      const taskMap = new Map(current.map((t) => [t.name, t]));
      for (const task of next) {
        taskMap.set(task.name, { ...taskMap.get(task.name), ...task });
      }
      return Array.from(taskMap.values());
    },
  }),

  // Phases - "poppa tasks" computed from child tasks for frontend display
  // Updated alongside tasks via the withPhases() helper
  phases: Annotation<Deploy.Phase[]>({
    default: () => [],
    reducer: (current, next) => {
      // Replace phases entirely when provided (they're computed from tasks)
      return next.length > 0 ? next : current;
    },
  }),
});

export type DeployGraphState = typeof DeployAnnotation.State;
type _Mismatches = ShowMismatches<DeployGraphState, typeof DeployAnnotation.State>;
type _Assertion = Expect<Equal<DeployGraphState, typeof DeployAnnotation.State>>;

// Bridge for streaming frontend - uses createAppBridge for automatic usage tracking
export const DeployBridge = createAppBridge({
  endpoint: "/api/deploy/stream",
  stateAnnotation: DeployAnnotation,
});

/**
 * Helper to update tasks AND compute phases in one operation
 *
 * Usage in nodes:
 * ```
 * return withPhases(state, [
 *   { ...Task.createTask("MyTask"), status: "completed" }
 * ]);
 * ```
 *
 * @param state - Current graph state (needs tasks array)
 * @param taskUpdates - Task updates to apply
 * @param phaseNames - Optional: only compute these phases (default: all)
 * @returns Object with both tasks and phases to spread into node return
 */
export function withPhases(
  state: { tasks: Task.Task[] },
  taskUpdates: Task.Task[],
  phaseNames?: Deploy.PhaseName[]
): { tasks: Task.Task[]; phases: Deploy.Phase[] } {
  // Merge task updates with current tasks (same logic as reducer)
  const taskMap = new Map(state.tasks.map((t) => [t.name, t]));
  for (const task of taskUpdates) {
    taskMap.set(task.name, { ...taskMap.get(task.name), ...task });
  }
  const mergedTasks = Array.from(taskMap.values());

  // Compute phases from merged tasks
  const phases = Deploy.computePhases(mergedTasks, phaseNames);

  return { tasks: taskUpdates, phases };
}

/**
 * Compute phases from current state without updating tasks
 * Useful when you just need to read phase status
 */
export function getPhasesFromState(
  state: { tasks: Task.Task[] },
  phaseNames?: Deploy.PhaseName[]
): Deploy.Phase[] {
  return Deploy.computePhases(state.tasks, phaseNames);
}
