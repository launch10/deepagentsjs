import * as GenericTask from "../task";
import type { Instructions, InstructionType } from "./types";
import * as Core from "../core";

/**
 * Deploy-specific Task Names and Descriptions
 *
 * Task names are 1:1 with phase names (e.g., "AddingAnalytics" task → "AddingAnalytics" phase)
 * Exception: ValidateLinks + RuntimeValidation merge into "CheckingForBugs" phase
 *
 * Usage: Deploy.createTask("AddingAnalytics") instead of Task.createTask("AddingAnalytics", "Adding Analytics")
 */

export const TaskNames = [
  // Google Setup (campaign only, skippable if already connected/verified)
  "ConnectingGoogle",
  "VerifyingGoogle",

  // Billing (campaign only — resolve all external Google blockers before website prep)
  "CheckingBilling",

  // Validation
  "ValidateLinks",
  "RuntimeValidation",
  "FixingBugs", // Only runs when validation fails

  // Website Preparation
  "OptimizingSEO",
  "AddingAnalytics",

  // Deploy
  "DeployingWebsite",

  // Campaign (only when deploying Google Ads)
  "DeployingCampaign",
  "EnablingCampaign",
] as const;
export type TaskName = (typeof TaskNames)[number];
export const TASK_ORDER = TaskNames;

const TasksForInstructions: Record<InstructionType, TaskName[]> = {
  website: ["ValidateLinks", "RuntimeValidation", "FixingBugs", "OptimizingSEO", "AddingAnalytics", "DeployingWebsite"],
  googleAds: ["ConnectingGoogle", "VerifyingGoogle", "CheckingBilling", "DeployingCampaign", "EnablingCampaign"],
}

const findTasksForInstructions = (instructions: Instructions): TaskName[] => {
  return Object.keys(instructions)
    .filter((key) => instructions[key as InstructionType])
    .flatMap((key) => TasksForInstructions[key as InstructionType]);
}

export const isTaskRequired = (instructions: Instructions, taskName: TaskName): boolean => {
  return findTasksForInstructions(instructions).includes(taskName);
}

export const findTasks = (instructions: Instructions): TaskName[] => {
  return findTasksForInstructions(instructions).sort((a, b) => TASK_ORDER.indexOf(a) - TASK_ORDER.indexOf(b));
}

export const createTasks = (instructions: Instructions): Task[] => {
  return findTasks(instructions).map((name) => createTask(name));
}

export const findEarlierTasks = (name: TaskName, instructions: Instructions): TaskName[] => {
  const tasks = findTasksForInstructions(instructions);
  const index = tasks.indexOf(name);
  return tasks.slice(0, index);
}

export const findTasksUpToAndIncluding = (name: TaskName, instructions: Instructions): TaskName[] => {
  const tasks = findTasksForInstructions(instructions);
  const index = tasks.indexOf(name);
  return tasks.slice(0, index + 1);
}

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
  RuntimeValidation: "Checking For Bugs",
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

/**
 * Task state specification - either a status string or full config
 */
type TaskSpec = Core.Status | {
  status: Core.Status;
  error?: string;
  result?: Record<string, unknown>;
};

interface WithTasksOptions {
  /** What to do with tasks after the last specified one. Default: "skip" */
  after?: "completed" | "skip";
}

/**
 * Declaratively set up task state for testing.
 * Specify the state of specific tasks; unspecified tasks before are "completed",
 * unspecified tasks after are "skip" by default (or "completed" with { after: "completed" }).
 *
 * @example
 * // RuntimeValidation failed, FixingBugs pending, tasks before completed, tasks after skipped
 * withTasks({ website: true }, {
 *   RuntimeValidation: { status: "failed", error: "Console errors" },
 *   FixingBugs: "pending"
 * })
 *
 * // Same but include all tasks after as completed too
 * withTasks({ website: true }, {
 *   RuntimeValidation: { status: "failed", error: "Console errors" },
 *   FixingBugs: "pending"
 * }, { after: "completed" })
 *
 * // Just make ValidateLinks pending, complete everything before it
 * withTasks({ website: true }, {
 *   ValidateLinks: "pending"
 * })
 */
export function withTasks(
  instructions: Instructions,
  taskSpecs: Partial<Record<TaskName, TaskSpec>>,
  options: WithTasksOptions = {}
): Task[] {
  const { after = "skip" } = options;
  const allTaskNames = findTasks(instructions);
  const specifiedTasks = Object.keys(taskSpecs) as TaskName[];

  // Find the last specified task to determine cutoff
  const lastSpecifiedIdx = Math.max(
    ...specifiedTasks.map(t => allTaskNames.indexOf(t))
  );

  return allTaskNames
    .map((name, idx) => {
      const task = createTask(name);
      const spec = taskSpecs[name];

      if (spec !== undefined) {
        // Task has explicit specification
        if (typeof spec === "string") {
          return { ...task, status: spec };
        }
        return {
          ...task,
          status: spec.status,
          ...(spec.error && { error: spec.error }),
          ...(spec.result && { result: spec.result })
        } as Task;
      }

      // No specification - complete if before/at last specified
      if (idx <= lastSpecifiedIdx) {
        return { ...task, status: "completed" as const };
      }

      // Tasks after last specified: use the `after` option
      if (after === "completed") {
        return { ...task, status: "completed" as const };
      }

      // Skip tasks after the last specified one
      return null;
    })
    .filter((t): t is Task => t !== null);
}
