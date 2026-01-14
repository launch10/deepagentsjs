import { describe, it, expect } from "vitest";
import { Deploy } from "@types";
import { withPhases, getPhasesFromState } from "@annotation";

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
   * - LaunchingCampaign → task "LaunchingCampaign"
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
      expect(phase.progress).toBe(0.5); // 1 of 2 tasks completed
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

  /**
   * =============================================================================
   * COMPUTE ALL PHASES
   * =============================================================================
   * These tests verify computing all phases from task state.
   */
  describe("computePhases", () => {
    it("computes all 9 phases when no filter provided", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
      ];

      const phases = Deploy.computePhases(tasks);

      expect(phases).toHaveLength(9); // All defined phases
      expect(phases.map((p) => p.name)).toEqual([
        "AddingAnalytics",
        "OptimizingSEO",
        "CheckingForBugs",
        "FixingBugs",
        "DeployingWebsite",
        "ConnectingGoogle",
        "VerifyingGoogle",
        "CheckingBilling",
        "LaunchingCampaign",
      ]);
    });

    it("computes only specified phases when filter provided", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
      ];

      const phases = Deploy.computePhases(tasks, ["AddingAnalytics", "CheckingForBugs"]);

      expect(phases).toHaveLength(2);
      expect(phases.map((p) => p.name)).toEqual(["AddingAnalytics", "CheckingForBugs"]);
    });

    it("correctly computes status for each phase", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
        { ...Deploy.createTask("ValidateLinks"), status: "running" },
      ];

      const phases = Deploy.computePhases(tasks, ["AddingAnalytics", "CheckingForBugs"]);

      expect(phases[0]!.status).toBe("completed"); // AddingAnalytics
      expect(phases[1]!.status).toBe("running"); // CheckingForBugs
    });
  });

  /**
   * =============================================================================
   * HELPER FUNCTIONS
   * =============================================================================
   */
  describe("findPhase", () => {
    it("finds phase by name", () => {
      const phases = Deploy.computePhases([]);
      const found = Deploy.findPhase(phases, "CheckingForBugs");

      expect(found).toBeDefined();
      expect(found?.name).toBe("CheckingForBugs");
    });

    it("returns undefined when phase not found", () => {
      const phases = Deploy.computePhases([], ["AddingAnalytics"]);
      const found = Deploy.findPhase(phases, "LaunchingCampaign");

      expect(found).toBeUndefined();
    });
  });

  describe("getActivePhases", () => {
    it("returns only non-pending phases", () => {
      const tasks: Deploy.Task[] = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
        { ...Deploy.createTask("ValidateLinks"), status: "running" },
      ];

      const phases = Deploy.computePhases(tasks);
      const active = Deploy.getActivePhases(phases);

      expect(active.length).toBe(2); // AddingAnalytics (completed) and CheckingForBugs (running)
      expect(active.map((p) => p.name)).toContain("AddingAnalytics");
      expect(active.map((p) => p.name)).toContain("CheckingForBugs");
    });

    it("returns empty array when all phases pending", () => {
      const phases = Deploy.computePhases([]);
      const active = Deploy.getActivePhases(phases);

      expect(active).toHaveLength(0);
    });
  });

  /**
   * =============================================================================
   * INTEGRATION: BUG CYCLE
   * =============================================================================
   * Tests the cycle: CheckingForBugs → FixingBugs → CheckingForBugs (retry)
   */
  describe("Bug Cycle Integration", () => {
    it("supports CheckingForBugs → FixingBugs → CheckingForBugs cycle", () => {
      // Step 1: CheckingForBugs running
      let tasks: Deploy.Task[] = [
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "running" },
      ];
      let phases = Deploy.computePhases(tasks, ["CheckingForBugs", "FixingBugs"]);

      expect(phases[0]!.status).toBe("running"); // CheckingForBugs
      expect(phases[1]!.status).toBe("pending"); // FixingBugs

      // Step 2: CheckingForBugs failed - found bugs
      tasks = [
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "failed", error: "Console errors" },
      ];
      phases = Deploy.computePhases(tasks, ["CheckingForBugs", "FixingBugs"]);

      expect(phases[0]!.status).toBe("failed");
      expect(phases[0]!.error).toBe("Console errors");

      // Step 3: FixingBugs running
      tasks = [
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "failed", error: "Console errors" },
        { ...Deploy.createTask("FixingBugs"), status: "running" },
      ];
      phases = Deploy.computePhases(tasks, ["CheckingForBugs", "FixingBugs"]);

      expect(phases[0]!.status).toBe("failed"); // Still shows failed
      expect(phases[1]!.status).toBe("running"); // FixingBugs running

      // Step 4: FixingBugs completed, re-running CheckingForBugs
      // In practice, we'd reset the validation tasks for retry
      tasks = [
        { ...Deploy.createTask("ValidateLinks"), status: "running" }, // Re-running
        { ...Deploy.createTask("RuntimeValidation"), status: "pending" }, // Will run after
        { ...Deploy.createTask("FixingBugs"), status: "completed" },
      ];
      phases = Deploy.computePhases(tasks, ["CheckingForBugs", "FixingBugs"]);

      expect(phases[0]!.status).toBe("running"); // CheckingForBugs re-running
      expect(phases[1]!.status).toBe("completed"); // FixingBugs done

      // Step 5: CheckingForBugs passes on retry
      tasks = [
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "completed" },
        { ...Deploy.createTask("FixingBugs"), status: "completed" },
      ];
      phases = Deploy.computePhases(tasks, ["CheckingForBugs", "FixingBugs"]);

      expect(phases[0]!.status).toBe("completed"); // CheckingForBugs passed
      expect(phases[1]!.status).toBe("completed"); // FixingBugs still completed
    });
  });

  /**
   * =============================================================================
   * INTEGRATION: FULL DEPLOY FLOW
   * =============================================================================
   * These tests verify phases work correctly through a full deploy scenario.
   */
  describe("Full Deploy Flow Integration", () => {
    it("shows correct phases through website deployment", () => {
      const websitePhases: Deploy.PhaseName[] = [
        "AddingAnalytics",
        "OptimizingSEO",
        "CheckingForBugs",
        "FixingBugs",
        "DeployingWebsite",
      ];

      // Step 1: Start - everything pending
      let tasks: Deploy.Task[] = [];
      let phases = Deploy.computePhases(tasks, websitePhases);

      expect(phases[0]!.status).toBe("pending"); // AddingAnalytics
      expect(phases[1]!.status).toBe("pending"); // OptimizingSEO
      expect(phases[2]!.status).toBe("pending"); // CheckingForBugs

      // Step 2: AddingAnalytics running
      tasks = [{ ...Deploy.createTask("AddingAnalytics"), status: "running" }];
      phases = Deploy.computePhases(tasks, websitePhases);

      expect(phases[0]!.status).toBe("running");
      expect(phases[0]!.progress).toBe(0);

      // Step 3: AddingAnalytics complete, OptimizingSEO complete, CheckingForBugs running
      tasks = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
        { ...Deploy.createTask("OptimizingSEO"), status: "completed" },
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "running" },
      ];
      phases = Deploy.computePhases(tasks, websitePhases);

      expect(phases[0]!.status).toBe("completed"); // AddingAnalytics
      expect(phases[1]!.status).toBe("completed"); // OptimizingSEO
      expect(phases[2]!.status).toBe("running"); // CheckingForBugs
      expect(phases[2]!.progress).toBe(0.5); // 1/2 validation tasks

      // Step 4: CheckingForBugs failed, FixingBugs running
      tasks = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
        { ...Deploy.createTask("OptimizingSEO"), status: "completed" },
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "failed", error: "Console errors" },
        { ...Deploy.createTask("FixingBugs"), status: "running" },
      ];
      phases = Deploy.computePhases(tasks, websitePhases);

      expect(phases[2]!.status).toBe("failed"); // CheckingForBugs
      expect(phases[2]!.error).toBe("Console errors");
      expect(phases[3]!.status).toBe("running"); // FixingBugs

      // Step 5: Bug fixed, all validation passes, deploying
      tasks = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
        { ...Deploy.createTask("OptimizingSEO"), status: "completed" },
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "completed" },
        { ...Deploy.createTask("FixingBugs"), status: "completed" },
        { ...Deploy.createTask("DeployingWebsite"), status: "running" },
      ];
      phases = Deploy.computePhases(tasks, websitePhases);

      expect(phases[0]!.status).toBe("completed");
      expect(phases[1]!.status).toBe("completed");
      expect(phases[2]!.status).toBe("completed");
      expect(phases[3]!.status).toBe("completed");
      expect(phases[4]!.status).toBe("running"); // DeployingWebsite

      // Step 6: Deploy complete!
      tasks = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
        { ...Deploy.createTask("OptimizingSEO"), status: "completed" },
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "completed" },
        { ...Deploy.createTask("FixingBugs"), status: "completed" },
        { ...Deploy.createTask("DeployingWebsite"), status: "completed" },
      ];
      phases = Deploy.computePhases(tasks, websitePhases);

      expect(phases.every((p) => p.status === "completed")).toBe(true);
    });
  });

  /**
   * =============================================================================
   * withPhases HELPER
   * =============================================================================
   * Tests for the annotation helper that updates tasks + phases together.
   */
  describe("withPhases helper", () => {
    it("returns tasks and computed phases together", () => {
      const state = {
        tasks: [{ ...Deploy.createTask("AddingAnalytics"), status: "completed" as const }],
      };

      const result = withPhases(state, [
        { ...Deploy.createTask("OptimizingSEO"), status: "completed" as const },
      ]);

      expect(result.tasks).toHaveLength(1); // Only the update
      expect(result.phases).toHaveLength(9); // All phases computed

      const analyticsPhase = result.phases.find((p) => p.name === "AddingAnalytics");
      expect(analyticsPhase?.status).toBe("completed");
      expect(analyticsPhase?.progress).toBe(1);

      const seoPhase = result.phases.find((p) => p.name === "OptimizingSEO");
      expect(seoPhase?.status).toBe("completed");
    });

    it("merges tasks correctly when computing phases", () => {
      const state = {
        tasks: [{ ...Deploy.createTask("ValidateLinks"), status: "completed" as const }],
      };

      const result = withPhases(state, [
        { ...Deploy.createTask("RuntimeValidation"), status: "running" as const },
      ]);

      const bugsPhase = result.phases.find((p) => p.name === "CheckingForBugs");
      expect(bugsPhase?.status).toBe("running");
      expect(bugsPhase?.progress).toBe(0.5); // 1/2 done
    });

    it("can filter to specific phases", () => {
      const state = { tasks: [] };

      const result = withPhases(state, [], ["AddingAnalytics", "CheckingForBugs"]);

      expect(result.phases).toHaveLength(2);
      expect(result.phases.map((p) => p.name)).toEqual(["AddingAnalytics", "CheckingForBugs"]);
    });
  });

  describe("getPhasesFromState helper", () => {
    it("computes phases from current state without task updates", () => {
      const state = {
        tasks: [{ ...Deploy.createTask("DeployingWebsite"), status: "completed" as const }],
      };

      const phases = getPhasesFromState(state);

      const deployPhase = phases.find((p) => p.name === "DeployingWebsite");
      expect(deployPhase?.status).toBe("completed");
      expect(deployPhase?.progress).toBe(1);
    });
  });
});
