import { z } from "zod";
import { v7 as uuid } from "uuid";

/**
 * ChecklistTask: Any generic task for graphs where multiple tasks are needed
 *
 * This is used by the LangGraph ↔ Rails async job pattern where:
 * 1. A graph node fires a Rails background job
 * 2. The node adds a task to the tasks[] array with status "pending"
 * 3. When the webhook returns, it updates the task with result/error
 * 4. The idempotent node checks the task status before doing work
 */

export const ChecklistTaskStatuses = ["pending", "running", "completed", "failed"] as const;
export type ChecklistTaskStatus = typeof ChecklistTaskStatuses[number];

export const TaskNames = [
  "CampaignDeploy",
  "WebsiteDeploy",
  "instrumentation",
  "website_deploy",
  "runtime_validation",
  "code_fix",
] as const;
export type TaskName = typeof TaskNames[number];

export const ChecklistTaskSchema = z.object({
  id: z.string().uuid(),
  name: z.enum(TaskNames), // Node name that owns this task
  jobId: z.number().optional(), // Rails JobRun ID
  status: z.enum(ChecklistTaskStatuses),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});

export type ChecklistTask = z.infer<typeof ChecklistTaskSchema>;

/**
 * Create a new async task with pending status
 */
export function createChecklistTask(name: TaskName, jobId?: number): ChecklistTask {
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
export function findChecklistTask(
  tasks: ChecklistTask[],
  name: TaskName
): ChecklistTask | undefined {
  return tasks.find((t) => t.name === name);
}

/**
 * Update a task by name, returning a new array with the updated task
 */
export function updateChecklistTask(
  tasks: ChecklistTask[],
  name: TaskName,
  updates: Partial<ChecklistTask>
): ChecklistTask[] {
  return tasks.map((t) => (t.name === name ? { ...t, ...updates } : t));
}
