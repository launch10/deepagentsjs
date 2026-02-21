import { z } from "zod";
import { v7 as uuid } from "uuid";
import { Statuses } from "./core";

/**
 * Task: Generic task for any graph workflow
 *
 * This is a generic task type. For deploy-specific typed tasks,
 * use Deploy.createTask() and Deploy.TaskName.
 *
 * Used by the LangGraph ↔ Rails async job pattern where:
 * 1. A graph node fires a Rails background job
 * 2. The node adds a task to the tasks[] array with status "pending"
 * 3. When the webhook returns, it updates the task with result/error
 * 4. The idempotent node checks the task status before doing work
 */

export const TaskSchema = z.object({
  id: z.string().uuid(),
  name: z.string(), // Generic string - deploy uses typed TaskName
  description: z.string(),
  jobId: z.number().optional(), // Rails JobRun ID
  status: z.enum(Statuses),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  retryCount: z.number().default(0),
  blockingStartedAt: z.number().optional(), // Timestamp when task first entered blocking state
  warning: z.string().optional(), // Warning message set by Langgraph when task is taking long
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Create a new generic task with pending status
 */
export function createTask(name: string, description: string, jobId?: number): Task {
  return {
    id: uuid(),
    name,
    description,
    jobId,
    status: "pending",
    retryCount: 0,
  };
}

/**
 * Find a task by name in the tasks array
 */
export function findTask(tasks: Task[], name: string): Task | undefined {
  return tasks.find((t) => t.name === name);
}

/**
 * Update a task by name, returning a new array with the updated task
 */
export function updateTask(tasks: Task[], name: string, updates: Partial<Task>): Task[] {
  return tasks.map((t) => (t.name === name ? { ...t, ...updates } : t));
}

/**
 * Enqueue a task (create if not exists, mark as running)
 */
export function enqueueTask(tasks: Task[], name: string, description: string): Task[] {
  if (findTask(tasks, name)) {
    return tasks;
  }
  const task = createTask(name, description);

  return [...tasks, { ...task, status: "running" }];
}