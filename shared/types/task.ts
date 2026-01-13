import { z } from "zod";
import { v7 as uuid } from "uuid";
import { Statuses } from "./core";

/**
 * Task: Any generic task for graphs where multiple tasks are needed
 *
 * This is used by the LangGraph ↔ Rails async job pattern where:
 * 1. A graph node fires a Rails background job
 * 2. The node adds a task to the tasks[] array with status "pending"
 * 3. When the webhook returns, it updates the task with result/error
 * 4. The idempotent node checks the task status before doing work
 */

export const TaskNames = [
  "CampaignDeploy",
  "WebsiteDeploy",
  "Instrumentation",
  "ValidateLinks",
  "RuntimeValidation",
  "BugFix",
] as const;
export type TaskName = typeof TaskNames[number];

export const TaskSchema = z.object({
  id: z.string().uuid(),
  name: z.enum(TaskNames), // Node name that owns this task
  jobId: z.number().optional(), // Rails JobRun ID
  status: z.enum(Statuses),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  retryCount: z.number().default(0),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Create a new async task with pending status
 */
export function createTask(name: TaskName, jobId?: number): Task {
  return {
    id: uuid(),
    name,
    jobId,
    status: "pending",
    retryCount: 0,
  };
}

/**
 * Find a task by name in the tasks array
 */
export function findTask(
  tasks: Task[],
  name: TaskName
): Task | undefined {
  return tasks.find((t) => t.name === name);
}

/**
 * Update a task by name, returning a new array with the updated task
 */
export function updateTask(
  tasks: Task[],
  name: TaskName,
  updates: Partial<Task>
): Task[] {
  return tasks.map((t) => (t.name === name ? { ...t, ...updates } : t));
}

export function enqueueTask(tasks: Task[], taskName: TaskName): Task[] {
  if (findTask(tasks, taskName)) {
    return tasks;
  }
  const task = createTask(taskName)

  return [...tasks, {
    ...task,
    status: "running"
  }];
}