import { z } from "zod";
import { v7 as uuid } from "uuid";

/**
 * AsyncTask: Tracks long-running background jobs for idempotent graph execution.
 *
 * This is used by the LangGraph ↔ Rails async job pattern where:
 * 1. A graph node fires a Rails background job
 * 2. The node adds a task to the tasks[] array with status "pending"
 * 3. When the webhook returns, it updates the task with result/error
 * 4. The idempotent node checks the task status before doing work
 */

export const AsyncTaskStatus = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
} as const;

export type AsyncTaskStatusType =
  (typeof AsyncTaskStatus)[keyof typeof AsyncTaskStatus];

export const asyncTaskSchema = z.object({
  id: z.string().uuid(),
  name: z.string(), // Node name that owns this task
  jobId: z.number().optional(), // Rails JobRun ID
  status: z.enum(["pending", "running", "completed", "failed"]),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});

export type AsyncTask = z.infer<typeof asyncTaskSchema>;

/**
 * Create a new async task with pending status
 */
export function createAsyncTask(name: string, jobId?: number): AsyncTask {
  return {
    id: uuid(),
    name,
    jobId,
    status: "pending",
  };
}

/**
 * Find a task by name in the tasks array
 */
export function findAsyncTask(
  tasks: AsyncTask[],
  name: string
): AsyncTask | undefined {
  return tasks.find((t) => t.name === name);
}

/**
 * Update a task by name, returning a new array with the updated task
 */
export function updateAsyncTask(
  tasks: AsyncTask[],
  name: string,
  updates: Partial<AsyncTask>
): AsyncTask[] {
  return tasks.map((t) => (t.name === name ? { ...t, ...updates } : t));
}
