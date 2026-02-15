import { z } from "zod";
import { v7 as uuid } from "uuid";
import { Statuses, type Status } from "../core";
import type { Task } from "../task";
import { type TaskName } from "./tasks";

/**
 * Phase: A "poppa task" - mostly 1:1 with tasks, shown to frontend
 *
 * Phases represent steps the user sees in the UI. Most are 1:1 with tasks,
 * except "CheckingForBugs" which combines ValidateLinks + RuntimeValidation.
 *
 * Cycles are valid! e.g.:
 *   CheckingForBugs (failed) → FixingBugs → CheckingForBugs (retry)
 */

export const PhaseNames = [
  // Google setup (campaign only, 1:1 each)
  "ConnectingGoogle",
  "VerifyingGoogle",

  // Billing (campaign only — resolve all external Google blockers before website prep)
  "CheckingBilling",

  // Validation cycle
  "CheckingForBugs", // ValidateLinks + RuntimeValidation (merged)
  "FixingBugs", // BugFix (1:1)

  // Website preparation (1:1)
  "OptimizingSEO",
  "AddingAnalytics",

  // Website deployment (1:1)
  "DeployingWebsite",

  // Campaign deployment (1:1)
  "DeployingCampaign",
  "EnablingCampaign",
] as const;
export type PhaseName = (typeof PhaseNames)[number];

export const PhaseDescriptionMap: Record<PhaseName, string> = {
  AddingAnalytics: "Adding Analytics",
  OptimizingSEO: "Optimizing SEO",
  CheckingForBugs: "Checking for Bugs",
  FixingBugs: "Squashing Bugs",
  DeployingWebsite: "Launching Website",
  ConnectingGoogle: "Signing into Google",
  VerifyingGoogle: "Verifying Google Account",
  CheckingBilling: "Checking Payment Status",
  DeployingCampaign: "Syncing Campaign",
  EnablingCampaign: "Enabling Campaign",
} as const;

/**
 * Maps phase names to their constituent task names
 *
 * Most phases are 1:1 with tasks (same name). Only exception:
 * - CheckingForBugs = ValidateLinks + RuntimeValidation
 */
export const PhaseTaskMap: Record<PhaseName, TaskName[]> = {
  // 1:1 phases: task name === phase name
  AddingAnalytics: ["AddingAnalytics"],
  OptimizingSEO: ["OptimizingSEO"],
  FixingBugs: ["FixingBugs"],
  DeployingWebsite: ["DeployingWebsite"],
  ConnectingGoogle: ["ConnectingGoogle"],
  VerifyingGoogle: ["VerifyingGoogle"],
  CheckingBilling: ["CheckingBilling"],
  DeployingCampaign: ["DeployingCampaign"],
  EnablingCampaign: ["EnablingCampaign"],
  // Merged phase: two tasks combine into one phase
  CheckingForBugs: ["ValidateLinks", "RuntimeValidation"],
} as const;

export const PhaseSchema = z.object({
  id: z.string().uuid(),
  name: z.enum(PhaseNames),
  description: z.string(),
  status: z.enum(Statuses),
  /** Progress 0-1 based on completed tasks */
  progress: z.number().min(0).max(1),
  /** Child task names for this phase */
  taskNames: z.array(z.string()),
  /** Optional error from failed child task */
  error: z.string().optional(),
});

export type Phase = z.infer<typeof PhaseSchema>;

/**
 * Whether a task status is terminal (no more work to do)
 */
function isTerminalStatus(status: string): boolean {
  return status === "completed" || status === "passed" || status === "skipped" || status === "failed";
}

/**
 * Compute the status of a phase from its child tasks
 *
 * Rules:
 * - If no tasks exist yet: "pending"
 * - If any task is "running": "running"
 * - If all tasks are terminal (completed/passed/skipped/failed):
 *   - If any task failed: "failed"
 *   - Otherwise: "completed"
 * - Otherwise: "running" (some tasks started, some pending)
 */
export function computePhaseStatus(tasks: Task[]): Status {
  if (tasks.length === 0) return "pending";

  const hasRunning = tasks.some((t) => t.status === "running");
  if (hasRunning) return "running";

  if (tasks.every((t) => isTerminalStatus(t.status))) {
    if (tasks.some((t) => t.status === "failed")) return "failed";
    return "completed";
  }

  return "running"; // Some tasks started, some pending
}

/**
 * Compute progress (0-1) for a phase based on terminal tasks
 */
export function computePhaseProgress(tasks: Task[], totalExpectedTasks: number): number {
  if (totalExpectedTasks === 0) return 0;

  const doneCount = tasks.filter((t) => isTerminalStatus(t.status)).length;

  return doneCount / totalExpectedTasks;
}

/**
 * Get the first error from failed tasks in a phase
 */
export function getPhaseError(tasks: Task[]): string | undefined {
  const failedTask = tasks.find((t) => t.status === "failed" && t.error);
  return failedTask?.error;
}

/**
 * Create a phase from its definition and current tasks
 */
export function createPhase(phaseName: PhaseName, allTasks: Task[]): Phase {
  const taskNames = PhaseTaskMap[phaseName];
  const phaseTasks = allTasks.filter((t) => taskNames.includes(t.name as TaskName));

  return {
    id: uuid(),
    name: phaseName,
    description: PhaseDescriptionMap[phaseName],
    status: computePhaseStatus(phaseTasks),
    progress: computePhaseProgress(phaseTasks, taskNames.length),
    taskNames,
    error: getPhaseError(phaseTasks),
  };
}

/**
 * Compute all phases from current tasks
 *
 * Only includes phases that are relevant (have at least one task or are in sequence)
 */
export function computePhases(tasks: Task[], phaseNames?: PhaseName[]): Phase[] {
  const namesToCompute = phaseNames ?? PhaseNames;
  return namesToCompute.map((name) => createPhase(name, tasks));
}

/**
 * Find a phase by name
 */
export function findPhase(phases: Phase[], name: PhaseName): Phase | undefined {
  return phases.find((p) => p.name === name);
}

/**
 * Get active phases (non-pending phases that have started)
 */
export function getActivePhases(phases: Phase[]): Phase[] {
  return phases.filter((p) => p.status !== "pending" || p.progress > 0);
}
