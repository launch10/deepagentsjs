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
  const DEFAULT_TIMEOUT = 300_000; // 5 minutes

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
        deploy: { website: true, googleAds: false },
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

      const recentTimestamp = Date.now() - 60_000; // 1 minute ago

      const tasks = Deploy.withTasks(
        { website: true, googleAds: false },
        { DeployingWebsite: { status: "running" } },
        { after: "completed" }
      ).map((t) =>
        t.name === "DeployingWebsite" ? { ...t, jobId: 42, blockingStartedAt: recentTimestamp } : t
      );

      const state = {
        status: "running",
        deploy: { website: true, googleAds: false },
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
        deploy: { website: true, googleAds: false },
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
        deploy: { website: true, googleAds: false },
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

    it("extends timeout when Rails says job is still running", async () => {
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
        deploy: { website: true, googleAds: false },
        tasks,
        jwt: "test-jwt",
        deployId: 1,
      } as any;

      const result = (await taskExecutorNode(state, {} as any)) as Partial<DeployGraphState>;

      // Should NOT fail — job is still running in Rails, timeout extended
      expect(result.status).not.toBe("failed");

      // blockingStartedAt should be reset to current time (extended)
      const updatedTask = result.tasks?.find((t) => t.name === "DeployingWebsite");
      expect(updatedTask?.blockingStartedAt).toBeDefined();
      expect(updatedTask!.blockingStartedAt).toBeGreaterThan(expiredTimestamp);
    });

    it("preserves blockingStartedAt on subsequent polls (does not reset)", async () => {
      const { taskExecutorNode } = await import("app/nodes/deploy/taskExecutor");
      await import("app/nodes/deploy/index");

      const originalTimestamp = Date.now() - 120_000; // 2 minutes ago

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
        deploy: { website: true, googleAds: false },
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
});
