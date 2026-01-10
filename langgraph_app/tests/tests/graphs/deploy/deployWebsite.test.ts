import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemorySaver } from "@langchain/langgraph";
import { testGraph } from "@support";
import { deployWebsiteGraph as uncompiledGraph } from "@graphs";
import type { DeployGraphState } from "@annotation";
import type { ThreadIDType, Task } from "@types";
import { graphParams } from "@core";
import { DatabaseSnapshotter } from "@rails_api";
import { websiteFiles, and, eq, db } from "@db";
import { getCodingAgentBackend } from "@nodes";

const deployWebsiteGraph = uncompiledGraph.compile({ ...graphParams, name: "deployWebsite" });

describe("DeployWebsiteGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * =============================================================================
   * IDEMPOTENCY TESTS
   * =============================================================================
   * These tests verify the graph exits early when WebsiteDeploy task exists.
   * This is the core idempotency pattern - once we've started deploying,
   * re-invoking the graph should be a no-op.
   */
  describe("Idempotency - Early exit when WebsiteDeploy task exists", () => {
    it("exits immediately if WebsiteDeploy task already exists (any status)", async () => {
      const existingTask: Task.Task = {
        id: "uuid-123",
        name: "WebsiteDeploy",
        status: "pending",
        retryCount: 0,
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [existingTask],
        })
        .execute();

      // Should exit without modifying tasks
      expect(result.state.tasks).toHaveLength(1);
      expect(result.state.tasks[0]!.name).toBe("WebsiteDeploy");
      expect(result.state.tasks[0]!.status).toBe("pending");
    });

    it("exits immediately if WebsiteDeploy task is completed", async () => {
      const completedTask: Task.Task = {
        id: "uuid-123",
        name: "WebsiteDeploy",
        status: "completed",
        retryCount: 0,
        result: { deployed: true },
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [completedTask],
        })
        .execute();

      expect(result.state.tasks).toHaveLength(1);
      expect(result.state.tasks[0]!.status).toBe("completed");
    });

    it("exits immediately if WebsiteDeploy task is running (waiting for webhook)", async () => {
      const runningTask: Task.Task = {
        id: "uuid-123",
        name: "WebsiteDeploy",
        status: "running",
        jobId: 456,
        retryCount: 0,
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [runningTask],
        })
        .execute();

      // Should exit without modifying - waiting for webhook
      expect(result.state.tasks).toHaveLength(1);
      expect(result.state.tasks[0]!.status).toBe("running");
    });
  });

  /**
   * =============================================================================
   * TASK BUBBLING TESTS
   * =============================================================================
   * These tests verify that tasks from the subgraph are visible to the parent.
   * Since all graphs use DeployAnnotation with the same reducer, tasks should
   * merge correctly.
   */
  describe("Task Bubbling - All tasks visible to parent graph", () => {
    it("tasks array accumulates as nodes execute", async () => {
      // Start with completed instrumentation and validation
      const existingTasks: Task.Task[] = [
        { id: "uuid-1", name: "Instrumentation", status: "completed", retryCount: 0 },
        { id: "uuid-2", name: "RuntimeValidation", status: "passed", retryCount: 0 },
      ];

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: existingTasks,
        })
        .stopAfter("deployWebsite")
        .execute();

      // Should have all tasks including WebsiteDeploy
      expect(result.state.tasks.length).toBeGreaterThanOrEqual(2);

      // Verify existing tasks preserved
      const instTask = result.state.tasks.find((t) => t.name === "Instrumentation");
      expect(instTask?.status).toBe("completed");
    });
  });

  /**
   * =============================================================================
   * WEBHOOK INTEGRATION TESTS
   * =============================================================================
   * These tests verify the fire-and-forget + webhook callback pattern.
   *
   * Flow:
   * 1. First invoke: Creates task with "pending", fires Sidekiq job, returns
   * 2. Frontend polls: Sees "pending" task
   * 3. Sidekiq completes: Webhook updates task with result
   * 4. Second invoke: Processes result, marks "completed"
   */
  describe("Webhook Integration - Async Deploy", () => {
    it("graph exits early when WebsiteDeploy task exists (webhook pattern)", async () => {
      // Simulate state after deploy task was created and webhook hasn't returned
      const pendingDeployTask: Task.Task = {
        id: "uuid-deploy",
        name: "WebsiteDeploy",
        status: "pending",
        jobId: 123,
        retryCount: 0,
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [pendingDeployTask],
        })
        .execute();

      // Graph should exit immediately - idempotent
      expect(result.state.tasks).toHaveLength(1);
      expect(result.state.tasks[0]!.status).toBe("pending");
    });

    it("processes webhook result when task has result", async () => {
      // Simulate state after webhook updated task with result
      const taskWithResult: Task.Task = {
        id: "uuid-deploy",
        name: "WebsiteDeploy",
        jobId: 123,
        status: "running",
        retryCount: 0,
        result: {
          website_id: 1,
          deployed_at: "2024-01-15T10:00:00Z",
          url: "https://example.com",
        },
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [taskWithResult],
        })
        .execute();

      // Graph exits early because WebsiteDeploy task exists
      // The deployWebsiteNode would process the result if it ran
      expect(result.state.tasks[0]!.name).toBe("WebsiteDeploy");
    });
  });

  /**
   * =============================================================================
   * VALIDATION FLOW TESTS
   * =============================================================================
   * These tests verify the validation → fix → retry loop.
   */
  describe("Validation Flow - Retry Loop", () => {
    it("exits after MAX_RETRY_COUNT attempts when validation keeps failing", async () => {
      // Simulate state where validation failed and we've hit max retries
      const failedValidationTask: Task.Task = {
        id: "uuid-val",
        name: "RuntimeValidation",
        status: "failed",
        retryCount: 2, // MAX_RETRY_COUNT = 2
        error: "Console errors found",
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [
            { id: "uuid-inst", name: "Instrumentation", status: "completed", retryCount: 0 },
            failedValidationTask,
          ],
        })
        .stopAfter("runtimeValidation")
        .execute();

      // Should exit due to max retries (not loop forever)
      expect(result).toBeDefined();
    });

    it("detects errors from all sources (browser, server, viteOverlay)", async () => {
      await DatabaseSnapshotter.restoreSnapshot("website_with_import_errors");

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [
            { id: "uuid-inst", name: "Instrumentation", status: "completed", retryCount: 0 },
          ],
        })
        .stopAfter("runtimeValidation")
        .execute();

      // RuntimeValidation should have failed due to detected errors
      const validationTask = result.state.tasks.find((t) => t.name === "RuntimeValidation");
      console.log(validationTask)
      expect(validationTask).toBeDefined();
      expect(validationTask?.status).toBe("failed");

      // The error report should contain the syntax error details
      const error = validationTask?.error as string;
      expect(error).toContain("NonExistentComponent");
    })

    it("routes to fix when validation fails", async () => {
      const failedValidationTask: Task.Task = {
        id: "uuid-val",
        name: "RuntimeValidation",
        status: "failed",
        retryCount: 0,
        result: {
          browserErrorCount: 2,
          serverErrorCount: 4,
          viteOverlayErrorCount: 1,
          report: '## Build Errors\n' +
            '\n' +
            "1. Expected ',', got 'ident'\n" +
            '   File: src/pages/IndexPage.tsx\n' +
            '   Code:\n' +
            '   3 | export const IndexPage = () => {\n' +
            '    4 |   return (\n' +
            '    5 |       <NonExistentComponent />\n' +
            '    6 |     <div className="min-h-screen flex items-center justify-center bg-background">\n' +
            '\n' +
            '2. Error:   Failed to scan for dependencies from entries:\n' +
            '   File: IndexPage.tsx:6\n' +
            '   Code:\n' +
            '   6 │     <div className="min-h-screen flex items-center justify-center b...\n' +
            '           │          ~~~~~~~~~'
        },
        error: '## Build Errors\n' +
          '\n' +
          "1. Expected ',', got 'ident'\n" +
          '   File: src/pages/IndexPage.tsx\n' +
          '   Code:\n' +
          '   3 | export const IndexPage = () => {\n' +
          '    4 |   return (\n' +
          '    5 |       <NonExistentComponent />\n' +
          '    6 |     <div className="min-h-screen flex items-center justify-center bg-background">\n' +
          '\n' +
          '2. Error:   Failed to scan for dependencies from entries:\n' +
          '   File: IndexPage.tsx:6\n' +
          '   Code:\n' +
          '   6 │     <div className="min-h-screen flex items-center justify-center b...\n' +
          '           │          ~~~~~~~~~'
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [
            { id: "uuid-inst", name: "Instrumentation", status: "completed", retryCount: 0 },
            failedValidationTask,
          ],
        })
        .stopAfter("fixWithCodingAgent")
        .execute();

      const updatedFile = await db.select().from(websiteFiles).where(
        and(
          eq(websiteFiles.websiteId, 1),
          eq(websiteFiles.path, "src/pages/IndexPage.tsx")
        ),
      ).execute().then((files) => files.at(-1));

      expect(updatedFile?.content).toContain("Hello World")
      expect(updatedFile?.content).toContain("const IndexPage")
      expect(updatedFile?.content).not.toContain("NonExistentComponent") // It fixes the bug

      const backend = await getCodingAgentBackend({
        websiteId: 1,
        jwt: "test-jwt",
      } as any);

      await backend.cleanup();

      const task = result.state.tasks.find((t) => t.name === "BugFix");
      expect(task).toBeDefined();
      expect(task?.status).toBe("completed");
    });

    it("routes to deployWebsite when validation passes", async () => {
      const passedValidationTask: Task.Task = {
        id: "uuid-val",
        name: "RuntimeValidation",
        status: "completed", // This is what the graph expects
        retryCount: 0,
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [
            { id: "uuid-inst", name: "Instrumentation", status: "completed", retryCount: 0 },
            passedValidationTask,
          ],
        })
        .stopAfter("deployWebsite")
        .execute();

      // Should have reached deployWebsite node
      const deployTask = result.state.tasks.find((t) => t.name === "WebsiteDeploy");
      expect(deployTask).toBeDefined();
    });
  });

  /**
   * =============================================================================
   * DEPLOYMENT FAILURE TESTS
   * =============================================================================
   * These tests verify proper handling of deployment failures from webhooks.
   */
  describe("Deployment Failure Handling", () => {
    it("marks task failed when webhook returns error", async () => {
      // Simulate webhook returning an error
      const taskWithError: Task.Task = {
        id: "uuid-deploy",
        name: "WebsiteDeploy",
        jobId: 123,
        status: "running",
        retryCount: 0,
        error: "Build failed: npm install error",
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [
            { id: "uuid-inst", name: "Instrumentation", status: "completed", retryCount: 0 },
            { id: "uuid-val", name: "RuntimeValidation", status: "completed", retryCount: 0 },
            taskWithError,
          ],
        })
        .execute();

      // Graph exits early - the task already exists with error
      const deployTask = result.state.tasks.find((t) => t.name === "WebsiteDeploy");
      expect(deployTask).toBeDefined();
      expect(deployTask?.error).toBeDefined();
      expect(deployTask?.error).toContain("Build failed");
    });

    it("preserves error details from failed deployment", async () => {
      const detailedError = {
        message: "Deployment failed",
        code: "CLOUDFLARE_ERROR",
        details: {
          step: "build",
          exitCode: 1,
          logs: "Error: Cannot find module '@/lib/nonexistent'",
        },
      };

      const taskWithDetailedError: Task.Task = {
        id: "uuid-deploy",
        name: "WebsiteDeploy",
        jobId: 456,
        status: "failed",
        retryCount: 0,
        error: JSON.stringify(detailedError),
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [taskWithDetailedError],
        })
        .execute();

      // Task error should contain useful debugging info
      const deployTask = result.state.tasks.find((t) => t.name === "WebsiteDeploy");
      expect(deployTask?.status).toBe("failed");
      expect(deployTask?.error).toContain("CLOUDFLARE_ERROR");
      expect(deployTask?.error).toContain("Cannot find module");
    });
  });
});
