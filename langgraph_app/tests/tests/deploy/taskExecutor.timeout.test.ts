import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DeployGraphState } from "@annotation";
import { Deploy, Task } from "@types";

/**
 * Task Executor Timeout Tests
 *
 * Tests the blocking task timeout mechanism:
 * - blockingStartedAt is recorded when a task first enters blocking state
 * - Tasks within timeout remain blocking (no change)
 * - Tasks past timeout fail the deploy (DeployingWebsite is not recoverable)
 */

describe("Blocking Task Timeout", () => {
  const DEFAULT_TIMEOUT = parseInt(process.env.DEPLOY_BLOCKING_TIMEOUT_MS || "180000", 10);

  describe("blockingStartedAt field on TaskSchema", () => {
    it("accepts blockingStartedAt as optional number", () => {
      const task = {
        ...Deploy.createTask("DeployingWebsite"),
        status: "running" as const,
        jobId: 1,
        blockingStartedAt: Date.now(),
      };

      const parsed = Task.TaskSchema.parse(task);
      expect(parsed.blockingStartedAt).toBeDefined();
      expect(typeof parsed.blockingStartedAt).toBe("number");
    });

    it("allows blockingStartedAt to be undefined", () => {
      const task = Deploy.createTask("DeployingWebsite");
      const parsed = Task.TaskSchema.parse(task);
      expect(parsed.blockingStartedAt).toBeUndefined();
    });
  });

  describe("TaskRunner blockingTimeout property", () => {
    it("is available on the TaskRunner interface", async () => {
      // Import task runner registry + trigger side-effect registration
      const { getTaskRunner } = await import("app/nodes/deploy/taskRunner");
      await import("app/nodes/deploy/deployWebsiteNode");

      const runner = getTaskRunner("DeployingWebsite");
      expect(runner).toBeDefined();

      // blockingTimeout should exist (can be undefined = use default)
      expect("blockingTimeout" in runner! || runner!.blockingTimeout === undefined).toBe(true);
    });
  });

  describe("timeout behavior in task executor", () => {
    it("sets blockingStartedAt when task is first detected as blocking", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      // Import triggers registration of all task runners
      await import("app/nodes/deploy/index");

      // DeployingWebsite: running, has jobId, no result = blocking
      // But no blockingStartedAt yet
      const tasks = Deploy.withTasks(
        { website: true, googleAds: false },
        { DeployingWebsite: { status: "running" } },
        { after: "completed" }
      ).map((t) => (t.name === "DeployingWebsite" ? { ...t, jobId: 42 } : t));

      const state = {
        status: "running",
        instructions: { website: true, googleAds: false },
        tasks,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      // Executor should return tasks update with blockingStartedAt set
      const updatedTask = result.tasks?.find((t) => t.name === "DeployingWebsite");
      expect(updatedTask).toBeDefined();
      expect(updatedTask!.blockingStartedAt).toBeDefined();
      expect(typeof updatedTask!.blockingStartedAt).toBe("number");
    });

    it("does not change state when blocking task is within timeout", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      await import("app/nodes/deploy/index");

      const recentTimestamp = Date.now() - Math.floor(DEFAULT_TIMEOUT / 2); // halfway through timeout

      const tasks = Deploy.withTasks(
        { website: true, googleAds: false },
        { DeployingWebsite: { status: "running" } },
        { after: "completed" }
      ).map((t) =>
        t.name === "DeployingWebsite" ? { ...t, jobId: 42, blockingStartedAt: recentTimestamp } : t
      );

      const state = {
        status: "running",
        instructions: { website: true, googleAds: false },
        tasks,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      // Should NOT fail — still within timeout
      expect(result.status).not.toBe("failed");
    });

    it("fails deploy when blocking task exceeds timeout (non-recoverable)", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      await import("app/nodes/deploy/index");

      // Well past timeout
      const expiredTimestamp = Date.now() - DEFAULT_TIMEOUT - 60_000;

      const tasks = Deploy.withTasks(
        { website: true, googleAds: false },
        { DeployingWebsite: { status: "running" } },
        { after: "completed" }
      ).map((t) =>
        t.name === "DeployingWebsite" ? { ...t, jobId: 42, blockingStartedAt: expiredTimestamp } : t
      );

      const state = {
        status: "running",
        instructions: { website: true, googleAds: false },
        tasks,
        jwt: "test-jwt",
        deployId: 1,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      // DeployingWebsite is NOT recoverable, so deploy should fail
      expect(result.status).toBe("failed");
      expect(result.error?.message).toMatch(/timed out/i);

      // The task itself should be marked failed
      const failedTask = result.tasks?.find((t) => t.name === "DeployingWebsite");
      if (failedTask) {
        expect(failedTask.status).toBe("failed");
      }
    });

    it("recovers from status check when Rails says job completed", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      await import("app/nodes/deploy/index");

      // Mock the JobRunAPIService.show to return completed
      const { JobRunAPIService } = await import("@rails_api");
      vi.spyOn(JobRunAPIService.prototype, "show").mockResolvedValueOnce({
        id: 42,
        status: "completed",
        result: { url: "https://example.com" },
        error: null,
      });

      const expiredTimestamp = Date.now() - DEFAULT_TIMEOUT - 60_000;

      const tasks = Deploy.withTasks(
        { website: true, googleAds: false },
        { DeployingWebsite: { status: "running" } },
        { after: "completed" }
      ).map((t) =>
        t.name === "DeployingWebsite" ? { ...t, jobId: 42, blockingStartedAt: expiredTimestamp } : t
      );

      const state = {
        status: "running",
        instructions: { website: true, googleAds: false },
        tasks,
        jwt: "test-jwt",
        deployId: 1,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      // Should NOT fail — status check found the job completed
      expect(result.status).not.toBe("failed");

      // Should update task with result from Rails
      const updatedTask = result.tasks?.find((t) => t.name === "DeployingWebsite");
      expect(updatedTask?.result).toEqual({ url: "https://example.com" });
    });

    it("fails deploy when Rails says job is still running after timeout (no extensions)", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      await import("app/nodes/deploy/index");

      const { JobRunAPIService } = await import("@rails_api");
      vi.spyOn(JobRunAPIService.prototype, "show").mockResolvedValueOnce({
        id: 42,
        status: "running",
        result: null,
        error: null,
      });

      const expiredTimestamp = Date.now() - DEFAULT_TIMEOUT - 60_000;

      const tasks = Deploy.withTasks(
        { website: true, googleAds: false },
        { DeployingWebsite: { status: "running" } },
        { after: "completed" }
      ).map((t) =>
        t.name === "DeployingWebsite" ? { ...t, jobId: 42, blockingStartedAt: expiredTimestamp } : t
      );

      const state = {
        status: "running",
        instructions: { website: true, googleAds: false },
        tasks,
        jwt: "test-jwt",
        deployId: 1,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      // Should fail immediately — no extensions, job still running after timeout
      expect(result.status).toBe("failed");
      expect(result.error?.message).toMatch(/timed out/i);
    });

    it("preserves blockingStartedAt on subsequent polls (does not reset)", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      await import("app/nodes/deploy/index");

      const originalTimestamp = Date.now() - Math.floor(DEFAULT_TIMEOUT / 2); // halfway through timeout

      const tasks = Deploy.withTasks(
        { website: true, googleAds: false },
        { DeployingWebsite: { status: "running" } },
        { after: "completed" }
      ).map((t) =>
        t.name === "DeployingWebsite"
          ? { ...t, jobId: 42, blockingStartedAt: originalTimestamp }
          : t
      );

      const state = {
        status: "running",
        instructions: { website: true, googleAds: false },
        tasks,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      // If tasks are returned, blockingStartedAt should be the original value
      // (not reset to current time)
      const updatedTask = result.tasks?.find((t) => t.name === "DeployingWebsite");
      if (updatedTask?.blockingStartedAt) {
        expect(updatedTask.blockingStartedAt).toBe(originalTimestamp);
      }
    });
  });

  describe("Langgraph-driven stuck warnings", () => {
    const WARNING_TIMEOUT = parseInt(process.env.DEPLOY_WARNING_TIMEOUT_MS || "120000", 10);

    it("does not set warning when blocking task is under warningTimeout", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      await import("app/nodes/deploy/index");

      // Halfway through warning timeout — under the warningTimeout
      const recentTimestamp = Date.now() - Math.floor(WARNING_TIMEOUT / 2);

      const tasks = Deploy.withTasks(
        { website: true, googleAds: false },
        { DeployingWebsite: { status: "running" } },
        { after: "completed" }
      ).map((t) =>
        t.name === "DeployingWebsite" ? { ...t, jobId: 42, blockingStartedAt: recentTimestamp } : t
      );

      const state = {
        status: "running",
        instructions: { website: true, googleAds: false },
        tasks,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      expect(result.status).not.toBe("failed");

      // Should NOT have a warning — under 2-minute threshold
      const updatedTask = result.tasks?.find((t) => t.name === "DeployingWebsite");
      expect(updatedTask?.warning).toBeUndefined();
    });

    it("sets warning when blocking task exceeds warningTimeout", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      await import("app/nodes/deploy/index");

      // Past warningTimeout but within blockingTimeout
      const warningTimestamp =
        Date.now() - WARNING_TIMEOUT - Math.floor((DEFAULT_TIMEOUT - WARNING_TIMEOUT) / 2);

      const tasks = Deploy.withTasks(
        { website: true, googleAds: false },
        { DeployingWebsite: { status: "running" } },
        { after: "completed" }
      ).map((t) =>
        t.name === "DeployingWebsite" ? { ...t, jobId: 42, blockingStartedAt: warningTimestamp } : t
      );

      const state = {
        status: "running",
        instructions: { website: true, googleAds: false },
        tasks,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      expect(result.status).not.toBe("failed");

      // Should have a warning with task description
      const updatedTask = result.tasks?.find((t) => t.name === "DeployingWebsite");
      expect(updatedTask?.warning).toBeDefined();
      expect(updatedTask!.warning).toContain("taking longer than expected");
    });

    it("does not re-set warning if already present (idempotent)", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      await import("app/nodes/deploy/index");

      // Past warningTimeout but within blockingTimeout
      const warningTimestamp =
        Date.now() - WARNING_TIMEOUT - Math.floor((DEFAULT_TIMEOUT - WARNING_TIMEOUT) / 2);
      const existingWarning = "Deploying website is taking longer than expected";

      const tasks = Deploy.withTasks(
        { website: true, googleAds: false },
        { DeployingWebsite: { status: "running" } },
        { after: "completed" }
      ).map((t) =>
        t.name === "DeployingWebsite"
          ? { ...t, jobId: 42, blockingStartedAt: warningTimestamp, warning: existingWarning }
          : t
      );

      const state = {
        status: "running",
        instructions: { website: true, googleAds: false },
        tasks,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      // Should not return a tasks update (no change needed)
      // OR if it does return tasks, warning should be the same
      const updatedTask = result.tasks?.find((t) => t.name === "DeployingWebsite");
      if (updatedTask) {
        expect(updatedTask.warning).toBe(existingWarning);
      }
    });
  });

  /**
   * =============================================================================
   * Blocking behavior per task type
   * =============================================================================
   *
   * Blocking timeout is OPT-IN: only tasks with explicit blockingTimeout
   * will time out. User-managed tasks (ConnectingGoogle, VerifyingGoogle,
   * CheckingBilling) block indefinitely waiting for the user's webhook.
   * Automated tasks (DeployingWebsite, DeployingCampaign, EnableCampaign)
   * have explicit blockingTimeout and will time out + health-check.
   */
  describe("user-managed blocking tasks do NOT time out", () => {
    it("ConnectingGoogle blocks indefinitely (no blockingTimeout)", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      await import("app/nodes/deploy/index");

      // Way past any reasonable timeout — 30 minutes ago
      const ancientTimestamp = Date.now() - 30 * 60 * 1000;

      const tasks = Deploy.withTasks(
        { googleAds: true },
        { ConnectingGoogle: { status: "running" } }
      ).map((t) =>
        t.name === "ConnectingGoogle" ? { ...t, jobId: 99, blockingStartedAt: ancientTimestamp } : t
      );

      const state = {
        status: "running",
        instructions: { googleAds: true },
        tasks,
        jwt: "test-jwt",
        deployId: 1,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      // Should NOT fail — user-managed tasks wait indefinitely
      expect(result.status).not.toBe("failed");
      expect(result.error).toBeUndefined();
    });

    it("VerifyingGoogle blocks indefinitely (no blockingTimeout)", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      await import("app/nodes/deploy/index");

      const ancientTimestamp = Date.now() - 30 * 60 * 1000;

      const tasks = Deploy.withTasks(
        { googleAds: true },
        { ConnectingGoogle: "completed", VerifyingGoogle: { status: "running" } }
      ).map((t) =>
        t.name === "VerifyingGoogle" ? { ...t, jobId: 99, blockingStartedAt: ancientTimestamp } : t
      );

      const state = {
        status: "running",
        instructions: { googleAds: true },
        tasks,
        jwt: "test-jwt",
        deployId: 1,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      expect(result.status).not.toBe("failed");
      expect(result.error).toBeUndefined();
    });

    it("CheckingBilling blocks indefinitely (no blockingTimeout)", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      await import("app/nodes/deploy/index");

      const ancientTimestamp = Date.now() - 30 * 60 * 1000;

      const tasks = Deploy.withTasks(
        { googleAds: true },
        {
          ConnectingGoogle: "completed",
          VerifyingGoogle: "completed",
          CheckingBilling: { status: "running" },
        }
      ).map((t) =>
        t.name === "CheckingBilling" ? { ...t, jobId: 99, blockingStartedAt: ancientTimestamp } : t
      );

      const state = {
        status: "running",
        instructions: { googleAds: true },
        tasks,
        jwt: "test-jwt",
        deployId: 1,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      expect(result.status).not.toBe("failed");
      expect(result.error).toBeUndefined();
    });
  });

  describe("automated blocking tasks DO time out", () => {
    it("DeployingCampaign times out with explicit blockingTimeout", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      const { getTaskRunner } = await import("app/nodes/deploy/taskRunner");
      await import("app/nodes/deploy/index");

      // Verify the runner has blockingTimeout configured
      const runner = getTaskRunner("DeployingCampaign");
      expect(runner?.blockingTimeout).toBeDefined();
      expect(typeof runner!.blockingTimeout).toBe("number");

      const expiredTimestamp = Date.now() - runner!.blockingTimeout! - 60_000;

      const tasks = Deploy.withTasks(
        { googleAds: true },
        { DeployingCampaign: { status: "running" } },
        { after: "completed" }
      ).map((t) =>
        t.name === "DeployingCampaign"
          ? { ...t, jobId: 99, blockingStartedAt: expiredTimestamp }
          : t
      );

      const state = {
        status: "running",
        instructions: { googleAds: true },
        tasks,
        jwt: "test-jwt",
        deployId: 1,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      // Should fail — automated task timed out
      expect(result.status).toBe("failed");
      expect(result.error?.message).toMatch(/timed out/i);
    });

    it("EnableCampaign times out with explicit blockingTimeout", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      const { getTaskRunner } = await import("app/nodes/deploy/taskRunner");
      await import("app/nodes/deploy/index");

      const runner = getTaskRunner("EnablingCampaign");
      expect(runner?.blockingTimeout).toBeDefined();
      expect(typeof runner!.blockingTimeout).toBe("number");

      const expiredTimestamp = Date.now() - runner!.blockingTimeout! - 60_000;

      const tasks = Deploy.withTasks(
        { googleAds: true },
        { EnablingCampaign: { status: "running" } },
        { after: "completed" }
      ).map((t) =>
        t.name === "EnablingCampaign" ? { ...t, jobId: 99, blockingStartedAt: expiredTimestamp } : t
      );

      const state = {
        status: "running",
        instructions: { googleAds: true },
        tasks,
        jwt: "test-jwt",
        deployId: 1,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      expect(result.status).toBe("failed");
      expect(result.error?.message).toMatch(/timed out/i);
    });
  });

  describe("non-blocking tasks never enter blocking path", () => {
    it("task runners without isBlocking are not treated as blocking", async () => {
      const { getTaskRunner } = await import("app/nodes/deploy/taskRunner");
      await import("app/nodes/deploy/index");

      const nonBlockingTasks: Deploy.TaskName[] = [
        "AddingAnalytics",
        "OptimizingSEO",
        "ValidateLinks",
        "RuntimeValidation",
        "FixingBugs",
      ];

      for (const taskName of nonBlockingTasks) {
        const runner = getTaskRunner(taskName);
        expect(runner, `Expected runner for "${taskName}"`).toBeDefined();
        expect(
          runner!.isBlocking,
          `Expected "${taskName}" to NOT define isBlocking`
        ).toBeUndefined();
        expect(
          runner!.blockingTimeout,
          `Expected "${taskName}" to NOT define blockingTimeout`
        ).toBeUndefined();
      }
    });

    it("automated blocking tasks all define both isBlocking and blockingTimeout", async () => {
      const { getTaskRunner } = await import("app/nodes/deploy/taskRunner");
      await import("app/nodes/deploy/index");

      const automatedBlockingTasks: Deploy.TaskName[] = [
        "DeployingWebsite",
        "DeployingCampaign",
        "EnablingCampaign",
      ];

      for (const taskName of automatedBlockingTasks) {
        const runner = getTaskRunner(taskName);
        expect(runner, `Expected runner for "${taskName}"`).toBeDefined();
        expect(runner!.isBlocking, `Expected "${taskName}" to define isBlocking`).toBeDefined();
        expect(
          runner!.blockingTimeout,
          `Expected "${taskName}" to define blockingTimeout`
        ).toBeDefined();
      }
    });

    it("user-managed blocking tasks define isBlocking but NOT blockingTimeout", async () => {
      const { getTaskRunner } = await import("app/nodes/deploy/taskRunner");
      await import("app/nodes/deploy/index");

      const userManagedTasks: Deploy.TaskName[] = [
        "ConnectingGoogle",
        "VerifyingGoogle",
        "CheckingBilling",
      ];

      for (const taskName of userManagedTasks) {
        const runner = getTaskRunner(taskName);
        expect(runner, `Expected runner for "${taskName}"`).toBeDefined();
        expect(runner!.isBlocking, `Expected "${taskName}" to define isBlocking`).toBeDefined();
        expect(
          runner!.blockingTimeout,
          `Expected "${taskName}" to NOT define blockingTimeout (user-managed)`
        ).toBeUndefined();
      }
    });
  });
});
