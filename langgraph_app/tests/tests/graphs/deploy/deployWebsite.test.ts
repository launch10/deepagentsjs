import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemorySaver } from "@langchain/langgraph";
import { testGraph } from "@support";
import { deployWebsiteGraph as uncompiledGraph } from "@graphs";
import type { DeployGraphState } from "@annotation";
import type { ThreadIDType } from "@types";
import { Deploy } from "@types";
import { graphParams } from "@core";
import { DatabaseSnapshotter } from "@rails_api";
import { websiteFiles, and, eq, db } from "@db";
import { getCodingAgentBackend } from "@nodes";

const deployWebsiteGraph = uncompiledGraph.compile({ ...graphParams, name: "deployWebsite" });

/**
 * =============================================================================
 * SEO OPTIMIZATION TESTS
 * =============================================================================
 * These tests verify the SEO optimization node properly adds meta tags to index.html.
 *
 * USER OUTCOME: Landing pages have proper SEO meta tags for search engines
 * and social media sharing (Open Graph, Twitter Cards).
 */
describe("SEO Optimization - Meta Tags Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test that SEO optimization adds the required meta tags to index.html <head>
   * TODO: These tests hit real AI APIs - need recorded responses or database snapshots
   */
  it("adds SEO meta tags to index.html", async () => {
    // Use website_step_finished snapshot which has a complete website
    await DatabaseSnapshotter.restoreSnapshot("website_step_finished");

    const result = await testGraph<DeployGraphState>()
      .withGraph(deployWebsiteGraph)
      .withState({
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        websiteId: 1,
        deploy: { website: true },
        tasks: [{ ...Deploy.createTask("AddingAnalytics"), status: "completed" }],
      })
      .stopAfter("seoOptimization")
      .execute();

    // Verify the SEO task completed
    const seoTask = result.state.tasks.find((t) => t.name === "OptimizingSEO");
    expect(seoTask).toBeDefined();
    expect(seoTask?.status).toBe("completed");

    // Verify the actual USER OUTCOME: meta tags are now in index.html
    const indexFile = await db
      .select()
      .from(websiteFiles)
      .where(and(eq(websiteFiles.websiteId, 1), eq(websiteFiles.path, "index.html")))
      .execute()
      .then((files) => files.at(-1));

    expect(indexFile?.content).toBeDefined();

    // Required SEO meta tags
    expect(indexFile?.content).toContain('<meta name="description"');
    expect(indexFile?.content).toContain("<title>");

    // Open Graph tags
    expect(indexFile?.content).toContain('<meta property="og:title"');
    expect(indexFile?.content).toContain('<meta property="og:description"');
    expect(indexFile?.content).toContain('<meta property="og:image"');
    expect(indexFile?.content).toContain('<meta property="og:url"');

    // Twitter Card tags
    expect(indexFile?.content).toContain('<meta name="twitter:card"');
    expect(indexFile?.content).toContain('<meta name="twitter:title"');
    expect(indexFile?.content).toContain('<meta name="twitter:description"');
    expect(indexFile?.content).toContain('<meta name="twitter:image"');

    // Canonical URL
    expect(indexFile?.content).toContain('<link rel="canonical"');

    // Cleanup the coding agent backend
    const backend = await getCodingAgentBackend({
      websiteId: 1,
      jwt: "test-jwt",
    } as any);
    await backend.cleanup();
  });

  it("sets og:image with absolute URL", async () => {
    await DatabaseSnapshotter.restoreSnapshot("website_step_finished");

    const result = await testGraph<DeployGraphState>()
      .withGraph(deployWebsiteGraph)
      .withState({
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        websiteId: 1,
        deploy: { website: true },
        tasks: [{ ...Deploy.createTask("AddingAnalytics"), status: "completed" }],
      })
      .stopAfter("seoOptimization")
      .execute();

    const indexFile = await db
      .select()
      .from(websiteFiles)
      .where(and(eq(websiteFiles.websiteId, 1), eq(websiteFiles.path, "index.html")))
      .execute()
      .then((files) => files.at(-1));

    // Verify og:image points to an actual image URL
    const ogImageMatch = indexFile?.content?.match(/<meta property="og:image" content="([^"]+)"/);
    expect(ogImageMatch).toBeDefined();
    if (ogImageMatch) {
      expect(ogImageMatch[1]).toMatch(/^https?:\/\//); // Must be absolute URL
    }

    // Cleanup
    const backend = await getCodingAgentBackend({
      websiteId: 1,
      jwt: "test-jwt",
    } as any);
    await backend.cleanup();
  });

  it("skips SEO optimization if task already completed", async () => {
    const completedTask: Deploy.Task = {
      id: "uuid-seo",
      name: "OptimizingSEO",
      description: "Optimizing SEO",
      status: "completed",
      retryCount: 0,
    };

    const result = await testGraph<DeployGraphState>()
      .withGraph(deployWebsiteGraph)
      .withState({
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        websiteId: 1,
        deploy: { website: true },
        tasks: [{ ...Deploy.createTask("AddingAnalytics"), status: "completed" }, completedTask],
      })
      .stopAfter("seoOptimization")
      .execute();

    // Should proceed without re-running SEO optimization
    const seoTask = result.state.tasks.find((t) => t.name === "OptimizingSEO");
    expect(seoTask).toBeDefined();
    expect(seoTask?.status).toBe("completed");
  });

  it("includes favicon URL for logo uploads in SEO context", async () => {
    // Use website_finished snapshot which has uploads including logos
    await DatabaseSnapshotter.restoreSnapshot("website_step_finished");

    const result = await testGraph<DeployGraphState>()
      .withGraph(deployWebsiteGraph)
      .withState({
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        websiteId: 1,
        deploy: { website: true },
        tasks: [{ ...Deploy.createTask("AddingAnalytics"), status: "completed" }],
      })
      .stopAfter("seoOptimization")
      .execute();

    // Verify the SEO task completed
    const seoTask = result.state.tasks.find((t) => t.name === "OptimizingSEO");
    expect(seoTask).toBeDefined();
    expect(seoTask?.status).toBe("completed");

    // Verify the actual USER OUTCOME: favicon link is now in index.html
    const indexFile = await db
      .select()
      .from(websiteFiles)
      .where(and(eq(websiteFiles.websiteId, 1), eq(websiteFiles.path, "index.html")))
      .execute()
      .then((files) => files.at(-1));

    expect(indexFile?.content).toBeDefined();

    // Favicon link should be present
    // TODO: we want to probably generate 32x32 ico image...
    expect(indexFile?.content).toContain('<link rel="icon"');

    // Cleanup the coding agent backend
    const backend = await getCodingAgentBackend({
      websiteId: 1,
      jwt: "test-jwt",
    } as any);
    await backend.cleanup();
  });

  it("SEO node is in the correct position in graph flow", async () => {
    // This test verifies that SEO optimization runs between instrumentation and validateLinks
    const result = await testGraph<DeployGraphState>()
      .withGraph(deployWebsiteGraph)
      .withState({
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        websiteId: 1,
        deploy: { website: true },
        tasks: [{ ...Deploy.createTask("AddingAnalytics"), status: "completed" }],
      })
      .stopAfter("seoOptimization")
      .execute();

    // Verify the SEO task was created and attempted
    const tasks = result.state.tasks;
    const seoTask = tasks.find((t) => t.name === "OptimizingSEO");

    expect(seoTask).toBeDefined();
    // The task might be completed or failed, but it should exist
    // This proves the graph flow goes through SEO after instrumentation
    expect(["completed", "failed", "running"]).toContain(seoTask?.status);

    // If it failed, check the error for debugging
    if (seoTask?.status === "failed" && seoTask.error) {
      console.log("SEO task error:", seoTask.error);
    }
  });
});

describe.skip("DeployWebsiteGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * =============================================================================
   * IDEMPOTENCY TESTS
   * =============================================================================
   * These tests verify the graph exits early when DeployingWebsite task exists.
   * This is the core idempotency pattern - once we've started deploying,
   * re-invoking the graph should be a no-op.
   */
  describe("Idempotency - Early exit when DeployingWebsite task exists", () => {
    it("exits immediately if DeployingWebsite task already exists (any status)", async () => {
      const existingTask: Deploy.Task = {
        ...Deploy.createTask("DeployingWebsite"),
        status: "pending",
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
      expect(result.state.tasks[0]!.name).toBe("DeployingWebsite");
      expect(result.state.tasks[0]!.status).toBe("pending");
    });

    it("exits immediately if DeployingWebsite task is completed", async () => {
      const completedTask: Deploy.Task = {
        ...Deploy.createTask("DeployingWebsite"),
        status: "completed",
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

    it("exits immediately if DeployingWebsite task is running (waiting for webhook)", async () => {
      const runningTask: Deploy.Task = {
        ...Deploy.createTask("DeployingWebsite", 456),
        status: "running",
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
   * INSTRUMENTATION TESTS
   * =============================================================================
   * These tests verify the instrumentation node properly adds L10.createLead()
   * to landing pages for lead capture tracking.
   *
   * USER OUTCOME: Lead capture works correctly after deployment because
   * instrumentation adds the necessary L10.createLead() calls.
   */
  describe("AddingAnalytics - Lead capture setup", () => {
    // TODO: These tests hit real AI APIs - need recorded responses
    it("adds L10.createLead() instrumentation to landing pages", async () => {
      // Use a snapshot that has a website without instrumentation
      await DatabaseSnapshotter.restoreSnapshot("website_with_import_errors");

      console.log(`running graph`);
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [],
        })
        .stopAfter("instrumentation")
        .execute();

      // Verify the instrumentation task completed
      const instrumentationTask = result.state.tasks.find((t) => t.name === "AddingAnalytics");
      expect(instrumentationTask).toBeDefined();
      expect(instrumentationTask?.status).toBe("completed");

      // Verify the actual USER OUTCOME: L10.createLead is now in the codebase
      // Check all website files for the instrumentation
      const allFiles = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, 1))
        .execute();

      // At least one file should contain L10.createLead for lead capture
      const hasAddingAnalytics = allFiles.some(
        (file) => file.content?.includes("L10.createLead") || file.content?.includes("createLead")
      );

      expect(hasAddingAnalytics).toBe(true);

      // Cleanup the coding agent backend
      const backend = await getCodingAgentBackend({
        websiteId: 1,
        jwt: "test-jwt",
      } as any);
      await backend.cleanup();
    });

    it("marks instrumentation task as completed when already instrumented", async () => {
      // When a website already has instrumentation, the node should just confirm
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [{ ...Deploy.createTask("AddingAnalytics"), status: "completed" }],
        })
        .stopAfter("runtimeValidation")
        .execute();

      // Should proceed without re-running instrumentation
      const instrumentationTask = result.state.tasks.find((t) => t.name === "AddingAnalytics");
      expect(instrumentationTask?.status).toBe("completed");
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
      const existingTasks: Deploy.Task[] = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "completed" },
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

      // Should have all tasks including DeployingWebsite
      expect(result.state.tasks.length).toBeGreaterThanOrEqual(2);

      // Verify existing tasks preserved
      const instTask = result.state.tasks.find((t) => t.name === "AddingAnalytics");
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
    it("graph exits early when DeployingWebsite task exists (webhook pattern)", async () => {
      // Simulate state after deploy task was created and webhook hasn't returned
      const pendingDeployTask: Deploy.Task = {
        ...Deploy.createTask("DeployingWebsite", 123),
        status: "pending",
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
      const taskWithResult: Deploy.Task = {
        ...Deploy.createTask("DeployingWebsite", 123),
        status: "running",
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

      // Graph exits early because DeployingWebsite task exists
      // The deployWebsiteNode would process the result if it ran
      expect(result.state.tasks[0]!.name).toBe("DeployingWebsite");
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
      const failedValidationTask: Deploy.Task = {
        ...Deploy.createTask("RuntimeValidation"),
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
            { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
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
          tasks: [{ ...Deploy.createTask("AddingAnalytics"), status: "completed" }],
        })
        .stopAfter("runtimeValidation")
        .execute();

      // RuntimeValidation should have failed due to detected errors
      const validationTask = result.state.tasks.find((t) => t.name === "RuntimeValidation");
      expect(validationTask).toBeDefined();
      expect(validationTask?.status).toBe("failed");

      // The error report should contain the syntax error details
      const error = validationTask?.error as string;
      expect(error).toContain("NonExistentComponent");
    });

    it("routes to fix when validation fails", async () => {
      await DatabaseSnapshotter.restoreSnapshot("website_with_import_errors");

      const failedValidationTask: Deploy.Task = {
        ...Deploy.createTask("RuntimeValidation"),
        status: "failed",
        result: {
          browserErrorCount: 2,
          serverErrorCount: 4,
          viteOverlayErrorCount: 1,
          report:
            "## Build Errors\n" +
            "\n" +
            "1. Expected ',', got 'ident'\n" +
            "   File: src/pages/IndexPage.tsx\n" +
            "   Code:\n" +
            "   3 | export const IndexPage = () => {\n" +
            "    4 |   return (\n" +
            "    5 |       <NonExistentComponent />\n" +
            '    6 |     <div className="min-h-screen flex items-center justify-center bg-background">\n' +
            "\n" +
            "2. Error:   Failed to scan for dependencies from entries:\n" +
            "   File: IndexPage.tsx:6\n" +
            "   Code:\n" +
            '   6 │     <div className="min-h-screen flex items-center justify-center b...\n' +
            "           │          ~~~~~~~~~",
        },
        error:
          "## Build Errors\n" +
          "\n" +
          "1. Expected ',', got 'ident'\n" +
          "   File: src/pages/IndexPage.tsx\n" +
          "   Code:\n" +
          "   3 | export const IndexPage = () => {\n" +
          "    4 |   return (\n" +
          "    5 |       <NonExistentComponent />\n" +
          '    6 |     <div className="min-h-screen flex items-center justify-center bg-background">\n' +
          "\n" +
          "2. Error:   Failed to scan for dependencies from entries:\n" +
          "   File: IndexPage.tsx:6\n" +
          "   Code:\n" +
          '   6 │     <div className="min-h-screen flex items-center justify-center b...\n' +
          "           │          ~~~~~~~~~",
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [
            { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
            failedValidationTask,
          ],
        })
        .stopAfter("bugFixNode")
        .execute();

      const updatedFile = await db
        .select()
        .from(websiteFiles)
        .where(and(eq(websiteFiles.websiteId, 1), eq(websiteFiles.path, "src/pages/IndexPage.tsx")))
        .execute()
        .then((files) => files.at(-1));

      // The bugFixNode uses an AI agent to fix the code - verify the fix was applied
      // The AI should remove the NonExistentComponent import and usage
      expect(updatedFile?.content).toContain("IndexPage"); // Component still exists
      expect(updatedFile?.content).not.toContain("NonExistentComponent"); // The bug is fixed

      const backend = await getCodingAgentBackend({
        websiteId: 1,
        jwt: "test-jwt",
      } as any);

      await backend.cleanup();

      const task = result.state.tasks.find((t) => t.name === "FixingBugs");
      expect(task).toBeDefined();
      expect(task?.status).toBe("completed");
    });

    it("routes to deployWebsite when validation passes", async () => {
      const passedValidationTask: Deploy.Task = {
        ...Deploy.createTask("RuntimeValidation"),
        status: "completed", // This is what the graph expects
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployWebsiteGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [
            { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
            passedValidationTask,
          ],
        })
        .stopAfter("deployWebsite")
        .execute();

      // Should have reached deployWebsite node
      const deployTask = result.state.tasks.find((t) => t.name === "DeployingWebsite");
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
      const taskWithError: Deploy.Task = {
        ...Deploy.createTask("DeployingWebsite", 123),
        status: "running",
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
            { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
            { ...Deploy.createTask("RuntimeValidation"), status: "completed" },
            taskWithError,
          ],
        })
        .execute();

      // Graph exits early - the task already exists with error
      const deployTask = result.state.tasks.find((t) => t.name === "DeployingWebsite");
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

      const taskWithDetailedError: Deploy.Task = {
        ...Deploy.createTask("DeployingWebsite", 456),
        status: "failed",
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
      const deployTask = result.state.tasks.find((t) => t.name === "DeployingWebsite");
      expect(deployTask?.status).toBe("failed");
      expect(deployTask?.error).toContain("CLOUDFLARE_ERROR");
      expect(deployTask?.error).toContain("Cannot find module");
    });
  });
});
