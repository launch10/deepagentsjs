import { describe, it, expect } from "vitest";
import { Deploy } from "@types";

describe("Phase", () => {
  /**
   * =============================================================================
   * PHASE STATUS COMPUTATION
   * =============================================================================
   * These tests verify the phase status is correctly computed from child tasks.
   */
  describe("computePhaseStatus", () => {
    it("returns 'pending' when no tasks exist", () => {
      const status = Deploy.computePhaseStatus([]);
      expect(status).toBe("pending");
    });

    it("returns 'running' when any task is running", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "running" },
      ];

      const status = Deploy.computePhaseStatus(tasks);
      expect(status).toBe("running");
    });

    it("returns 'completed' when all tasks are completed", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "completed" },
      ];

      const status = Deploy.computePhaseStatus(tasks);
      expect(status).toBe("completed");
    });

    it("returns 'failed' when a task failed and none are running", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "failed", error: "Console errors" },
      ];

      const status = Deploy.computePhaseStatus(tasks);
      expect(status).toBe("failed");
    });

    it("returns 'running' when some tasks completed and some pending", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "pending" },
      ];

      const status = Deploy.computePhaseStatus(tasks);
      expect(status).toBe("running");
    });

    it("treats 'passed' same as 'completed'", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("ValidateLinks"), status: "passed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "passed" },
      ];

      const status = Deploy.computePhaseStatus(tasks);
      expect(status).toBe("completed");
    });
  });

  /**
   * =============================================================================
   * PHASE PROGRESS COMPUTATION
   * =============================================================================
   * These tests verify progress is calculated correctly.
   */
  describe("computePhaseProgress", () => {
    it("returns 0 when no tasks expected", () => {
      const progress = Deploy.computePhaseProgress([], 0);
      expect(progress).toBe(0);
    });

    it("returns 0 when no tasks completed", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("ValidateLinks"), status: "pending" },
        { ...Deploy.createTask("RuntimeValidation"), status: "running" },
      ];

      const progress = Deploy.computePhaseProgress(tasks, 2);
      expect(progress).toBe(0);
    });

    it("returns 0.5 when half tasks completed", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "running" },
      ];

      const progress = Deploy.computePhaseProgress(tasks, 2);
      expect(progress).toBe(0.5);
    });

    it("returns 1 when all tasks completed", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "completed" },
      ];

      const progress = Deploy.computePhaseProgress(tasks, 2);
      expect(progress).toBe(1);
    });

    it("counts 'passed' as completed for progress", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("ValidateLinks"), status: "passed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "running" },
      ];

      const progress = Deploy.computePhaseProgress(tasks, 2);
      expect(progress).toBe(0.5);
    });
  });

  /**
   * =============================================================================
   * PHASE ERROR EXTRACTION
   * =============================================================================
   * These tests verify error extraction from failed tasks.
   */
  describe("getPhaseError", () => {
    it("returns undefined when no tasks failed", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
      ];

      const error = Deploy.getPhaseError(tasks);
      expect(error).toBeUndefined();
    });

    it("returns error from failed task", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        {
          ...Deploy.createTask("RuntimeValidation"),
          status: "failed",
          error: "Console errors found",
        },
      ];

      const error = Deploy.getPhaseError(tasks);
      expect(error).toBe("Console errors found");
    });

    it("returns first error when multiple tasks failed", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("ValidateLinks"), status: "failed", error: "First error" },
        { ...Deploy.createTask("RuntimeValidation"), status: "failed", error: "Second error" },
      ];

      const error = Deploy.getPhaseError(tasks);
      expect(error).toBe("First error");
    });
  });

  /**
   * =============================================================================
   * CREATE PHASE
   * =============================================================================
   * These tests verify full phase creation from tasks.
   *
   * Phase structure (1:1 naming - task name === phase name):
   * - AddingAnalytics → task "AddingAnalytics"
   * - OptimizingSEO → task "OptimizingSEO"
   * - FixingBugs → task "FixingBugs"
   * - DeployingWebsite → task "DeployingWebsite"
   * - ConnectingGoogle → task "ConnectingGoogle"
   * - VerifyingGoogle → task "VerifyingGoogle"
   * - CheckingBilling → task "CheckingBilling"
   * - DeployingCampaign → task "DeployingCampaign"
   * - CheckingForBugs → tasks "ValidateLinks" + "RuntimeValidation" (only merged phase)
   */
  describe("createPhase", () => {
    it("creates AddingAnalytics phase with 1:1 task mapping", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
      ];

      const phase = Deploy.createPhase("AddingAnalytics", tasks);

      expect(phase.name).toBe("AddingAnalytics");
      expect(phase.description).toBe("Adding Analytics");
      expect(phase.status).toBe("completed");
      expect(phase.progress).toBe(1);
      expect(phase.taskNames).toEqual(["AddingAnalytics"]);
      expect(phase.error).toBeUndefined();
    });

    it("creates CheckingForBugs phase (merged: ValidateLinks + RuntimeValidation)", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "failed", error: "Build errors" },
      ];

      const phase = Deploy.createPhase("CheckingForBugs", tasks);

      expect(phase.name).toBe("CheckingForBugs");
      expect(phase.description).toBe("Checking for Bugs");
      expect(phase.status).toBe("failed");
      expect(phase.progress).toBe(1); // Both tasks terminal (completed + failed)
      expect(phase.taskNames).toEqual(["ValidateLinks", "RuntimeValidation"]);
      expect(phase.error).toBe("Build errors");
    });

    it("creates FixingBugs phase separately from CheckingForBugs", () => {
      const tasks: Deploy.Task[] = [{ ...Deploy.createTask("FixingBugs"), status: "running" }];

      const phase = Deploy.createPhase("FixingBugs", tasks);

      expect(phase.name).toBe("FixingBugs");
      expect(phase.description).toBe("Squashing Bugs");
      expect(phase.status).toBe("running");
      expect(phase.taskNames).toEqual(["FixingBugs"]);
    });

    it("filters only relevant tasks for the phase", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "completed" }, // Different phase
        { ...Deploy.createTask("OptimizingSEO"), status: "completed" },
      ];

      const phase = Deploy.createPhase("AddingAnalytics", tasks);

      // Only counts AddingAnalytics, not OptimizingSEO or RuntimeValidation
      expect(phase.progress).toBe(1);
      expect(phase.status).toBe("completed");
    });

    it("creates pending phase when no tasks exist yet", () => {
      const phase = Deploy.createPhase("ConnectingGoogle", []);

      expect(phase.status).toBe("pending");
      expect(phase.progress).toBe(0);
      expect(phase.description).toBe("Signing into Google");
    });
  });
});
