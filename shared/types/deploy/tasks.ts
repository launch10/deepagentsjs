import * as GenericTask from "../task";

/**
 * Deploy-specific Task Names and Descriptions
 *
 * Task names are 1:1 with phase names (e.g., "AddingAnalytics" task → "AddingAnalytics" phase)
 * Exception: ValidateLinks + RuntimeValidation merge into "CheckingForBugs" phase
 *
 * Usage: Deploy.createTask("AddingAnalytics") instead of Task.createTask("AddingAnalytics", "Adding Analytics")
 */

export const TaskNames = [
  // 1:1 with phases (same name)
  "AddingAnalytics",
  "OptimizingSEO",
  "FixingBugs",
  "DeployingWebsite",
  "ConnectingGoogle",
  "VerifyingGoogle",
  "CheckingBilling",
  "DeployingCampaign",
  "EnablingCampaign",
  // Special: These two tasks merge into "CheckingForBugs" phase
  "ValidateLinks",
  "RuntimeValidation",
] as const;

export type TaskName = (typeof TaskNames)[number];

export const TaskDescriptionMap: Record<TaskName, string> = {
  // 1:1 with phases (use phase descriptions)
  AddingAnalytics: "Adding Analytics",
  OptimizingSEO: "Optimizing SEO",
  FixingBugs: "Squashing Bugs",
  DeployingWebsite: "Launching Website",
  ConnectingGoogle: "Signing into Google",
  VerifyingGoogle: "Verifying Google Account",
  CheckingBilling: "Checking Payment Status",
  DeployingCampaign: "Syncing Campaign",
  EnablingCampaign: "Enabling Campaign",
  // Special: merge into "CheckingForBugs" phase
  ValidateLinks: "Testing Links",
  RuntimeValidation: "Checking for Runtime Errors",
} as const;

export const TaskDescriptions = Object.values(TaskDescriptionMap);

// Re-export the generic Task type
export type Task = GenericTask.Task;

/**
 * Create a deploy task with typed name (description auto-filled)
 */
export function createTask(name: TaskName, jobId?: number): Task {
  return GenericTask.createTask(name, TaskDescriptionMap[name], jobId);
}

/**
 * Find a deploy task by typed name
 */
export function findTask(tasks: Task[], name: TaskName): Task | undefined {
  return GenericTask.findTask(tasks, name);
}

/**
 * Update a deploy task by typed name
 */
export function updateTask(tasks: Task[], name: TaskName, updates: Partial<Task>): Task[] {
  return GenericTask.updateTask(tasks, name, updates);
}

/**
 * Enqueue a deploy task (create if not exists, mark as running)
 */
export function enqueueTask(tasks: Task[], name: TaskName): Task[] {
  return GenericTask.enqueueTask(tasks, name, TaskDescriptionMap[name]);
}
