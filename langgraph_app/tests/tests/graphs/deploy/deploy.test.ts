import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WebsiteGraphState } from "@annotation";
import { testGraph } from "@support";
import { deployGraph as uncompiledGraph } from "@graphs";
import type { DeployGraphState } from "@annotation";
import type { ThreadIDType } from "@types";
import { Deploy, Task } from "@types";
import { graphParams } from "@core";
import { DatabaseSnapshotter } from "@rails_api";
import { websiteFiles, campaigns, and, eq, db } from "@db";
import { jobRunCallback } from "@server/routes/webhooks/jobRunCallback";
import {
  getCodingAgentBackend,
  analyticsNode,
  checkPaymentNode,
  enableCampaignNode,
  shouldCheckPayment,
} from "@nodes";

// Mock services
vi.mock("@services", async () => {
  const actual = await vi.importActual("@services");
  return {
    ...actual,
    GoogleAPIService: vi.fn(),
  };
});

vi.mock("@rails_api", async () => {
  const actual = await vi.importActual("@rails_api");
  return {
    ...actual,
    JobRunAPIService: vi.fn(),
    ChatsAPIService: vi.fn().mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({
        id: 1,
        thread_id: "thread_123",
        chat_type: "deploy",
        project_id: 1,
        account_id: 1,
      }),
      validate: vi.fn().mockResolvedValue({
        valid: true,
        exists: false,
      }),
    })),
  };
});

import { GoogleAPIService } from "@services";
import { JobRunAPIService } from "@rails_api";

const mockGoogleAPIService = vi.mocked(GoogleAPIService);
const mockJobRunAPIService = vi.mocked(JobRunAPIService);

const deployGraph = uncompiledGraph.compile({ ...graphParams, name: "deploy" });

// Clean up test files after each test (if website exists)
const TEST_WEBSITE_ID = 1;
afterEach(async () => {
  try {
    const backend = await getCodingAgentBackend({
      websiteId: TEST_WEBSITE_ID,
      jwt: "test-jwt",
    } as WebsiteGraphState);
    await backend.cleanup();
  } catch {
    // Website doesn't exist, nothing to clean up
  }
});

/**
 * =============================================================================
 * DEPLOY GRAPH TESTS
 * =============================================================================
 *
 * Tests are organized in workflow order matching the deploy graph flow:
 *
 * 1. Google Connect/Verify [campaign] - OAuth and invite acceptance
 * 2. Analytics [all] - L10.createLead instrumentation
 * 3. SEO Optimization [all] - Meta tags generation
 * 4. Phase Computation - Website Deploy phases
 * 5. Website Deploy Flow - Validation loop and deployment
 * 6. Full Workflow (skipped) - End-to-end tests
 * 7. Check Payment [campaign] - Payment verification
 * 8. shouldCheckPayment - Conditional routing
 * 9. Enable Campaign [campaign] - Campaign activation
 * 10. Payment and Enable Campaign Flow - Integration tests
 */

describe.sequential("Deploy Graph Tests", () => {
  /**
   * =============================================================================
   * 1. GOOGLE CONNECT/VERIFY TESTS [campaign]
   * =============================================================================
   * These tests verify the conditional routing for Google OAuth and invite flows.
   * The key principle: "Never enqueue what you won't run"
   */
  describe("Google Onboarding Flow", () => {
    let campaignId: number | undefined;

    beforeEach(async () => {
      vi.clearAllMocks();

      await DatabaseSnapshotter.restoreSnapshot("campaign_complete");
      campaignId = (await db.select().from(campaigns).limit(1).execute())[0]?.id;

      // Default: Google connected, invite accepted
      mockGoogleAPIService.mockImplementation(
        () =>
          ({
            getConnectionStatus: vi
              .fn()
              .mockResolvedValue({ connected: true, email: "user@gmail.com" }),
            getInviteStatus: vi
              .fn()
              .mockResolvedValue({ accepted: true, status: "accepted", email: "user@gmail.com" }),
          }) as any
      );

      // Default job run creation mock
      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: vi.fn().mockResolvedValue({ id: 123, status: "pending" }),
          }) as any
      );
    });

    describe("ConnectingGoogle", () => {
      it("skips ConnectingGoogle when Google is already connected", async () => {
        // Mock: Google connected, invite accepted
        mockGoogleAPIService.mockImplementation(
          () =>
            ({
              getConnectionStatus: vi
                .fn()
                .mockResolvedValue({ connected: true, email: "user@gmail.com" }),
              getInviteStatus: vi
                .fn()
                .mockResolvedValue({ accepted: true, status: "accepted", email: "user@gmail.com" }),
            }) as any
        );

        const result = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            campaignId: 123,
            deploy: { googleAds: true },
            tasks: [],
            chatId: 1,
          })
          .execute();

        // Both Google tasks should be skipped
        const googleConnectTask = Task.findTask(result.state.tasks, "ConnectingGoogle");
        expect(googleConnectTask?.status).toBe("skipped");
      });

      describe("When google account not already connected", () => {
        beforeEach(() => {
          // Mock: Google NOT connected
          mockGoogleAPIService.mockImplementation(
            () =>
              ({
                getConnectionStatus: vi.fn().mockResolvedValue({ connected: false, email: null }),
                getInviteStatus: vi
                  .fn()
                  .mockResolvedValue({ accepted: false, status: "none", email: null }),
              }) as any
          );
        });

        it("runs ConnectingGoogle when Google is NOT connected", async () => {
        const result = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            campaignId: 123,
            deploy: { googleAds: true },
            tasks: [],
            chatId: 1,
          })
          .execute();

        // Should have ConnectingGoogle task with running status
        const googleConnectTask = Task.findTask(result.state.tasks, "ConnectingGoogle");
        expect(googleConnectTask).toBeDefined();
        expect(googleConnectTask?.status).toBe("running");
        expect(result.state.tasks.length).toBe(1); // this is a blocking action, it will not have run other tasks...
        });

        it("continues to wait when already running ConnectingGoogle", async () => {
          const result = await testGraph<DeployGraphState>()
            .withGraph(deployGraph)
            .withState({
              jwt: "test-jwt",
              threadId: "thread_123" as ThreadIDType,
              websiteId: 1,
              campaignId: 123,
              deploy: { googleAds: true },
              tasks: Deploy.withTasks({ googleAds: true }, { ConnectingGoogle: "running" }),
              chatId: 1,
            })
            .execute();

          // Should have ConnectingGoogle task with running status
          const googleConnectTask = Task.findTask(result.state.tasks, "ConnectingGoogle");
          expect(googleConnectTask).toBeDefined();
          expect(googleConnectTask?.status).toBe("running");
          expect(result.state.tasks.length).toBe(1); // this is a blocking action, it will not have run other tasks...
        });

        it("continues to next step after receving job callback", async () => {
          const graph = testGraph<DeployGraphState>()
            .withGraph(deployGraph)
            .withState({
              jwt: "test-jwt",
              threadId: "thread_123" as ThreadIDType,
              websiteId: 1,
              campaignId,
              deploy: { googleAds: true },
              tasks: [],
              chatId: 1,
            })
          const result = await graph.execute();
          const googleConnectTask = Task.findTask(result.state.tasks, "ConnectingGoogle");

          await jobRunCallback({
            job_run_id: googleConnectTask?.jobId!,
            thread_id: graph.threadId!,
            status: "completed",
            result: { google_email: "test@gmail.com" },
          })

          const updates = (await deployGraph.getState({configurable: {
            thread_id: graph.threadId,
          }})).values;

          const updatedResult = await deployGraph.invoke(updates, {configurable: {
            thread_id: graph.threadId,
          }});

          const updatedGoogleConnectTask = Task.findTask(updatedResult.tasks, "ConnectingGoogle");
          const verifyingGoogleTask = Task.findTask(updatedResult.tasks, "VerifyingGoogle");

          // Should have ConnectingGoogle task with running status
          expect(updatedGoogleConnectTask).toBeDefined();
          expect(updatedGoogleConnectTask?.status).toBe("completed");
          expect(updatedResult.tasks.length).toBe(2); // this is a blocking action, it will not have run other tasks...
          expect(verifyingGoogleTask?.status).toBe("running");
        });
      });
    })

    describe("VerifyingGoogle", async () => {
      describe("When NOT deploying website", async () => {
        it("proceeds to DeployCampaign after both GoogleConnect and GoogleVerify complete", async () => {
          // Mock: Google connected, invite accepted
          mockGoogleAPIService.mockImplementation(
            () =>
              ({
                getConnectionStatus: vi
                  .fn()
                  .mockResolvedValue({ connected: true, email: "user@gmail.com" }),
                getInviteStatus: vi
                  .fn()
                  .mockResolvedValue({ accepted: false, status: "none" }),
              }) as any
          );

          const graph = testGraph<DeployGraphState>()
            .withGraph(deployGraph)
            .withState({
              jwt: "test-jwt",
              threadId: "thread_123" as ThreadIDType,
              websiteId: 1,
              campaignId,
              deploy: { googleAds: true },
              tasks: Deploy.withTasks({ googleAds: true }, { ConnectingGoogle: "completed" }),
              chatId: 1,
            })

          const result = await graph.execute();

          // Should have all tasks
          const googleVerifyTask = result.state.tasks.find((t) => t.name === "VerifyingGoogle");

          await jobRunCallback({
            job_run_id: googleVerifyTask?.jobId!,
            thread_id: graph.threadId!,
            status: "completed",
            result: { status: "accepted" },
          })

          const updates = (await deployGraph.getState({configurable: {
            thread_id: graph.threadId,
          }})).values;

          const updatedResult = await deployGraph.invoke(updates, {configurable: {
            thread_id: graph.threadId,
          }});

          const updatedGoogleVerifyTask = updatedResult.tasks.find((t) => t.name === "VerifyingGoogle");
          const deployTask = updatedResult.tasks.find((t) => t.name === "DeployingCampaign");

          expect(updatedGoogleVerifyTask?.status).toBe("completed");
          expect(deployTask).toBeDefined();
          expect(deployTask?.status).toBe("running"); // enqueueTask creates with running status
        });
      });

      describe("When YES deploying website", async () => {
        it("proceeds to Analytics after both GoogleConnect and GoogleVerify complete", async () => {
          // Mock createCodingAgent to skip actual LLM calls - just return immediately
          const mockAgent = { invoke: vi.fn().mockResolvedValue({ messages: [] }) };
          const createCodingAgentSpy = vi.spyOn(await import("@nodes"), "createCodingAgent")
            .mockResolvedValue(mockAgent as any);

          // Mock: Google connected, invite accepted
          mockGoogleAPIService.mockImplementation(
            () =>
              ({
                getConnectionStatus: vi
                  .fn()
                  .mockResolvedValue({ connected: true, email: "user@gmail.com" }),
                getInviteStatus: vi
                  .fn()
                  .mockResolvedValue({ accepted: false, status: "none" }),
              }) as any
          );

          // With the new flow: Google setup → analytics → seo → validation → deploy → campaign
          // We need website tasks completed to reach campaign
          const graph = testGraph<DeployGraphState>()
            .withGraph(deployGraph)
            .withState({
              jwt: "test-jwt",
              threadId: "thread_123" as ThreadIDType,
              websiteId: 1,
              campaignId,
              deploy: { googleAds: true, website: true },
              tasks: Deploy.withTasks({ googleAds: true, website: true }, { VerifyingGoogle: "pending" }),
              chatId: 1,
            })

          const result = await graph.execute();

          // Should have all tasks
          const googleVerifyTask = result.state.tasks.find((t) => t.name === "VerifyingGoogle");

          await jobRunCallback({
            job_run_id: googleVerifyTask?.jobId!,
            thread_id: graph.threadId!,
            status: "completed",
            result: { status: "accepted" },
          })

          // Resume graph - let it run through Analytics (mocked)
          const updatedResult = await deployGraph.invoke(null, {
            configurable: { thread_id: graph.threadId },
          });

          const updatedGoogleVerifyTask = updatedResult.tasks.find((t) => t.name === "VerifyingGoogle");
          const analyticsTask = updatedResult.tasks.find((t) => t.name === "AddingAnalytics");

          expect(updatedGoogleVerifyTask?.status).toBe("completed");
          expect(analyticsTask).toBeDefined();
          expect(analyticsTask?.status).toBe("completed"); // Should complete since agent is mocked

          // Cleanup
          createCodingAgentSpy.mockRestore();
        });

      })
    });
  });

  /**
   * =============================================================================
   * 2. ANALYTICS TESTS [all]
   * =============================================================================
   * These tests verify the instrumentation node properly adds L10.createLead()
   * to landing pages for lead capture tracking.
   *
   * USER OUTCOME: Lead capture works correctly after deployment because
   * instrumentation adds the necessary L10.createLead() calls.
   */
  describe("AddingAnalytics", () => {
    let campaignId: number | undefined;

    beforeEach(async () => {
      // Use a snapshot that doesn't have analytics
      await DatabaseSnapshotter.restoreSnapshot("website_step_finished");
      campaignId = (await db.select().from(campaigns).limit(1).execute())[0]?.id;
    });

    it("adds L10.createLead() instrumentation to landing pages", async () => {
      // Verify the actual USER OUTCOME: L10.createLead is now in the codebase
      // Check all website files for the instrumentation
      const filesBeforeRunning = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, 1))
        .execute();

      // At least one file should contain L10.createLead for lead capture
      const hasAnalyticsBeforeRunning = filesBeforeRunning.some(
        (file) => file.content?.includes("L10.createLead") || file.content?.includes("createLead")
      );

      expect(hasAnalyticsBeforeRunning).toBe(false);

      // Run just the analytics node in isolation - no need to run the full graph
      const result = await testGraph<DeployGraphState>()
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [Deploy.createTask("AddingAnalytics")],
          chatId: 1,
        })
        .runNode(analyticsNode)
        .execute();

      // Verify the instrumentation task completed
      const analyticsTask = result.state.tasks.find((t) => t.name === "AddingAnalytics");
      expect(analyticsTask).toBeDefined();
      expect(analyticsTask?.status).toBe("completed");

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
  });

  /**
   * =============================================================================
   * 3. SEO OPTIMIZATION TESTS [all]
   * =============================================================================
   * These tests verify the SEO optimization node properly adds meta tags to index.html.
   *
   * USER OUTCOME: Landing pages have proper SEO meta tags for search engines
   * and social media sharing (Open Graph, Twitter Cards).
   */
  describe("SEO Optimization", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    /**
     * Test that SEO optimization skips the agent when index.html already has
     * sufficient SEO meta tags.
     */
    it("skips agent when SEO is already done", async () => {
      await DatabaseSnapshotter.restoreSnapshot("website_step_finished");

      // Add SEO meta tags to index.html so it's already optimized
      const existingIndexHtml = await db
        .select()
        .from(websiteFiles)
        .where(and(eq(websiteFiles.websiteId, 1), eq(websiteFiles.path, "index.html")))
        .execute()
        .then((files) => files.at(-1));

      // Inject SEO meta tags into the existing index.html
      const seoTags = `
    <title>Test Landing Page</title>
    <meta name="description" content="This is a test landing page with great content">
    <meta property="og:title" content="Test Landing Page">
    <meta property="og:description" content="This is a test landing page">
    <meta property="og:image" content="https://example.com/image.png">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="https://example.com/favicon.ico">
`;
      const updatedContent = existingIndexHtml?.content?.replace(
        "<head>",
        `<head>${seoTags}`
      );

      await db
        .update(websiteFiles)
        .set({ content: updatedContent })
        .where(and(eq(websiteFiles.websiteId, 1), eq(websiteFiles.path, "index.html")))
        .execute();

      // Spy on createCodingAgent to verify it's NOT called
      const createCodingAgentSpy = vi.spyOn(await import("@nodes"), "createCodingAgent");

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: Deploy.withTasks({ website: true }, { OptimizingSEO: "pending" }, { after: "completed" }),
          chatId: 1
        })
        .stopAfter("seoOptimization")
        .execute();

      // Verify the SEO task completed
      const seoTask = result.state.tasks.find((t) => t.name === "OptimizingSEO");
      expect(seoTask).toBeDefined();
      expect(seoTask?.status).toBe("completed");

      // Verify the agent was NOT called (skipped due to already done)
      expect(createCodingAgentSpy).not.toHaveBeenCalled();

      // Cleanup
      createCodingAgentSpy.mockRestore();
    });

    /**
     * Test that SEO optimization adds the required meta tags to index.html <head>
     * TODO: These tests hit real AI APIs - need recorded responses or database snapshots
     */
    it("adds SEO meta tags to index.html", async () => {
      // Use website_step_finished snapshot which has a complete website
      await DatabaseSnapshotter.restoreSnapshot("website_step_finished");

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: Deploy.withTasks({ website: true }, { OptimizingSEO: "pending" }, { after: "completed" }),
          chatId: 1
        })
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
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: Deploy.withTasks({ website: true }, { OptimizingSEO: "pending" }, { after: "completed" }),
          chatId: 1
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

    it("includes favicon URL for logo uploads in SEO context", async () => {
      // Use website_finished snapshot which has uploads including logos
      await DatabaseSnapshotter.restoreSnapshot("website_step_finished");

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: Deploy.withTasks({ website: true }, { OptimizingSEO: "pending" }, { after: "completed" }),
          chatId: 1
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
  });

  /**
   * =============================================================================
   * 4. Fixing bugs
   * =============================================================================
   * These tests verify that bugs are identified and fixed
   */
  describe("Fixing bugs", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("CheckingForBugs Phase", () => {
      it("computes CheckingForBugs as pending when no validation tasks exist", async () => {
        // Test phase computation directly via the Deploy module
        // (The graph test helper has timing issues with stopAfter on enqueue nodes)
        const tasks: Deploy.Task[] = [
          { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
          { ...Deploy.createTask("OptimizingSEO"), status: "running" },
        ];

        const phases = Deploy.computePhases(tasks);
        const checkingForBugsPhase = phases.find((p) => p.name === "CheckingForBugs");

        expect(checkingForBugsPhase).toBeDefined();
        expect(checkingForBugsPhase?.status).toBe("pending");
        expect(checkingForBugsPhase?.progress).toBe(0);
      });

      it("computes CheckingForBugs as running when ValidateLinks is running", async () => {
        const result = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: Deploy.withTasks({ website: true }, { ValidateLinks: "pending" }),
            chatId: 1
          })
          .execute();

        const task = result.state.tasks.find((t) => t.name === "ValidateLinks");
        expect(task).toBeDefined();
        expect(task?.status).toBeOneOf(["completed", "failed"]);

        const checkingForBugsPhase = result.state.phases.find((p) => p.name === "CheckingForBugs");

        expect(checkingForBugsPhase).toBeDefined();
        expect(checkingForBugsPhase?.status).toBe("running");
        // ValidateLinks running, RuntimeValidation not yet started
        expect(checkingForBugsPhase?.progress).toBe(0);
      });

      it("computes CheckingForBugs as running when RuntimeValidation is running", async () => {
        const result = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: Deploy.withTasks({ website: true }, { RuntimeValidation: "pending" }),
            chatId: 1
          })
          .stopAfter("runtimeValidation")
          .execute();

        const task = result.state.tasks.find((t) => t.name === "RuntimeValidation");
        expect(task?.result?.report).toBeDefined();
        expect((task?.result?.report as any).errors).toBeUndefined();
        const checkingForBugsPhase = result.state.phases.find((p) => p.name === "CheckingForBugs");

        expect(checkingForBugsPhase).toBeDefined();
        // One task completed, one pending = running
        expect(checkingForBugsPhase?.status).toBe("running");
        expect(checkingForBugsPhase?.progress).toBe(0.5);
      });

      it("computes CheckingForBugs as failed when RuntimeValidation fails", async () => {
        const result = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: Deploy.withTasks({ website: true }, {
              RuntimeValidation: { status: "failed", error: "Console errors found in browser" }
            }, { after: "completed" }),
            chatId: 1
          })
          .execute();

        const checkingForBugsPhase = result.state.phases.find((p) => p.name === "CheckingForBugs");

        expect(checkingForBugsPhase).toBeDefined();
        expect(checkingForBugsPhase?.status).toBe("failed");
        expect(checkingForBugsPhase?.progress).toBe(0.5); // 1/2 completed
        expect(checkingForBugsPhase?.error).toBe("Console errors found in browser");
      });

      it("computes CheckingForBugs as completed when both ValidateLinks and RuntimeValidation pass", async () => {
        const result = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: Deploy.withTasks({ website: true }, { DeployingWebsite: "completed" }, { after: "completed" }),
            chatId: 1
          })
          .stopAfter("deployWebsite")
          .execute();

        const checkingForBugsPhase = result.state.phases.find((p) => p.name === "CheckingForBugs");

        expect(checkingForBugsPhase).toBeDefined();
        expect(checkingForBugsPhase?.status).toBe("completed");
        expect(checkingForBugsPhase?.progress).toBe(1);
        expect(checkingForBugsPhase?.error).toBeUndefined();
      });
    });

    describe("FixingBugs", () => {
      it("FixingBugs fixes bugs identified by RuntimeValidation", async () => {
        const tasks = Deploy.withTasks({ website: true }, {
          RuntimeValidation: { status: "failed", error: "This is a fake error, ignore it. Please do not attempt to fix it. Exit early" },
          FixingBugs: "pending"
        });
        const result = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks,
            chatId: 1
          })
          .execute();

        const checkingForBugsPhase = result.state.phases.find((p) => p.name === "CheckingForBugs");
        const fixingBugsPhase = result.state.phases.find((p) => p.name === "FixingBugs");

        // These are separate phases
        expect(checkingForBugsPhase).toBeDefined();
        expect(fixingBugsPhase).toBeDefined();
        expect(checkingForBugsPhase?.name).not.toBe(fixingBugsPhase?.name);

        // CheckingForBugs shows failed (validation found bugs)
        expect(checkingForBugsPhase?.status).toBe("failed");

        // FixingBugs shows running (actively fixing)
        expect(fixingBugsPhase?.status).toBe("completed");
      });

      it("FixingBugs fixes bugs identified by CheckingLinks", async () => {
        const tasks = Deploy.withTasks({ website: true }, {
          ValidateLinks: { status: "failed", error: "Broken anchor: #Hero - no element with id=\"Hero\" -- this is a fake error simply testing the internal workflow. Simply exit early, and we will mock as though you fixed the error." },
        });
        const result = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks,
            chatId: 1
          })
          .execute();

        const fixingBugsTask = result.state.tasks.find((t) => t.name === "FixingBugs");
        expect(fixingBugsTask?.status).toBe("completed");
      });
    });
  });

  /**
   * =============================================================================
   * 5. WEBSITE DEPLOY FLOW TESTS [all]
   * =============================================================================
   * These tests verify the deploy website flow including idempotency,
   * task bubbling, webhook integration, and validation.
   */
  describe("Website Deploy Flow", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("Idempotency - doesn't deploy if website is already deploying", () => {
      it("calls API on first pass, skips on second pass", async () => {
        const mockCreate = vi.fn().mockResolvedValue({ id: 123, status: "pending" });
        mockJobRunAPIService.mockImplementation(() => ({ create: mockCreate }) as any);

        // First pass: task is running, no jobId → should call API
        const firstResult = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: Deploy.withTasks({ website: true }, {
              DeployingWebsite: { status: "running" },
            }, { after: "completed" }),
            chatId: 1
          })
          .execute();

        // Verify API was called
        expect(mockCreate).toHaveBeenCalledTimes(1);

        // Verify task now has jobId
        const taskAfterFirst = firstResult.state.tasks.find((t) => t.name === "DeployingWebsite");
        expect(taskAfterFirst?.jobId).toBe(123);

        // Second pass: same state but with jobId → should NOT call API
        mockCreate.mockClear();

        const secondResult = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            ...firstResult.state, // Use state from first pass (has jobId)
          })
          .execute();

        // Verify API was NOT called again
        expect(mockCreate).not.toHaveBeenCalled();

        // Task should still be running (waiting for webhook)
        const taskAfterSecond = secondResult.state.tasks.find((t) => t.name === "DeployingWebsite");
        expect(taskAfterSecond?.status).toBe("running");
        expect(taskAfterSecond?.jobId).toBe(123);
      });

      it("exits immediately if DeployingWebsite task is completed", async () => {
        const mockCreate = vi.fn().mockResolvedValue({ id: 123, status: "pending" });
        mockJobRunAPIService.mockImplementation(() => ({ create: mockCreate }) as any);

        const completedTask: Deploy.Task = {
          ...Deploy.createTask("DeployingWebsite"),
          status: "completed",
          result: { deployed: true },
        };

        const result = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: [completedTask],
            chatId: 1
          })
          .execute();

        expect(result.state.tasks).toHaveLength(1);
        expect(result.state.tasks[0]!.status).toBe("completed");
        expect(mockCreate).not.toHaveBeenCalled();
      });
    });

    /**
     * TASK BUBBLING TESTS
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
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: existingTasks,
            chatId: 1
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
     * WEBHOOK INTEGRATION TESTS
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
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: [pendingDeployTask],
            chatId: 1
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
          .withGraph(deployGraph)
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
     * VALIDATION FLOW TESTS
     * These tests verify the validation -> fix -> retry loop.
     */
    describe("Validation Flow - Retry Loop", () => {
      // Helper: Tasks that need to be completed before validation runs
      // With new flow: analytics → seo → validation → deploy
      const completedPreValidationTasks = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" as const },
        { ...Deploy.createTask("OptimizingSEO"), status: "completed" as const },
      ];

      it("exits after MAX_RETRY_COUNT attempts when validation keeps failing", async () => {
        // Simulate state where validation failed and we've hit max retries
        const failedValidationTask: Deploy.Task = {
          ...Deploy.createTask("RuntimeValidation"),
          status: "failed",
          retryCount: 2, // MAX_RETRY_COUNT = 2
          error: "Console errors found",
        };

        const result = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: [...completedPreValidationTasks, failedValidationTask],
            chatId: 1
          })
          .stopAfter("runtimeValidation")
          .execute();

        // Should exit due to max retries (not loop forever)
        expect(result).toBeDefined();
      });

      it("detects errors from all sources (browser, server, viteOverlay)", async () => {
        await DatabaseSnapshotter.restoreSnapshot("website_with_import_errors");

        const result = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: [
              ...completedPreValidationTasks,
              { ...Deploy.createTask("ValidateLinks"), status: "completed" as const },
            ],
            chatId: 1
          })
          .stopAfter("runtimeValidation")
          .execute();

        // RuntimeValidation should have failed due to detected errors
        const validationTask = result.state.tasks.find((t) => t.name === "RuntimeValidation");
        expect(validationTask).toBeDefined();
        expect(validationTask?.status).toBe("failed");

        // The error report should contain error details (either import or syntax error)
        const error = validationTask?.error as string;
        expect(error).toBeDefined();
        expect(error.length).toBeGreaterThan(0);
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
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: [...completedPreValidationTasks, failedValidationTask],
            chatId: 1
          })
          .stopAfter("bugFix")
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
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: [
              ...completedPreValidationTasks,
              { ...Deploy.createTask("ValidateLinks"), status: "completed" },
              passedValidationTask,
            ],
            chatId: 1
          })
          .stopAfter("enqueueDeploy")
          .execute();

        // Should have reached deployWebsite node
        const deployTask = result.state.tasks.find((t) => t.name === "DeployingWebsite");
        expect(deployTask).toBeDefined();
        expect(deployTask?.status).toBe("running"); // enqueueTask creates with running status
      });
    });

    /**
     * DEPLOYMENT FAILURE TESTS
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
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: [
              { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
              { ...Deploy.createTask("OptimizingSEO"), status: "completed" },
              { ...Deploy.createTask("ValidateLinks"), status: "completed" },
              { ...Deploy.createTask("RuntimeValidation"), status: "completed" },
              taskWithError,
            ],
            chatId: 1
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
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            websiteId: 1,
            deploy: { website: true },
            tasks: [taskWithDetailedError],
            chatId: 1
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

  /**
   * =============================================================================
   * 7. CHECK PAYMENT NODE TESTS [campaign]
   * =============================================================================
   * Tests for the checkPaymentNode which verifies Google Ads payment/billing
   * status before enabling campaigns.
   */
  describe("checkPaymentNode - Payment Verification", () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: vi.fn().mockResolvedValue({ id: 456, status: "pending" }),
          }) as any
      );
    });

    describe("Idempotency", () => {
      it("returns {} when task is already completed", async () => {
        const completedTask: Deploy.Task = {
          ...Deploy.createTask("CheckingBilling"),
          status: "completed",
          result: { has_payment: true },
        };

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          tasks: [completedTask],
        };

        const result = await checkPaymentNode(state as DeployGraphState);

        expect(result).toEqual({});
      });

      it("returns {} when task is already failed", async () => {
        const failedTask: Deploy.Task = {
          ...Deploy.createTask("CheckingBilling"),
          status: "failed",
          error: "Payment check failed",
        };

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          tasks: [failedTask],
        };

        const result = await checkPaymentNode(state as DeployGraphState);

        expect(result).toEqual({});
      });

      it("returns {} when task is running and waiting for webhook", async () => {
        const runningTask: Deploy.Task = {
          ...Deploy.createTask("CheckingBilling"),
          status: "running",
          jobId: 123,
        };

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          tasks: [runningTask],
        };

        const result = await checkPaymentNode(state as DeployGraphState);

        expect(result).toEqual({});
      });
    });

    describe("First Invocation - Fire and Forget", () => {
      it("creates JobRun and returns task with jobId", async () => {
        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          tasks: [],
        };

        const result = await checkPaymentNode(state as DeployGraphState);

        // Verify JobRun was created
        expect(mockJobRunAPIService).toHaveBeenCalledWith({ jwt: "test-jwt" });

        // Verify task was created with jobId
        expect(result.tasks).toBeDefined();
        const task = result.tasks?.find((t) => t.name === "CheckingBilling");
        expect(task).toBeDefined();
        expect(task?.status).toBe("running");
        expect(task?.jobId).toBe(456);
      });

      it("includes deployId in JobRun when present", async () => {
        const mockCreate = vi.fn().mockResolvedValue({ id: 456, status: "pending" });
        mockJobRunAPIService.mockImplementation(() => ({ create: mockCreate }) as any);

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          deployId: 789,
          tasks: [],
        };

        await checkPaymentNode(state as DeployGraphState);

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            deployId: 789,
          })
        );
      });
    });

    describe("Webhook Result Processing", () => {
      it("marks task completed when webhook returns has_payment: true", async () => {
        const taskWithResult: Deploy.Task = {
          ...Deploy.createTask("CheckingBilling"),
          status: "running",
          jobId: 123,
          result: { has_payment: true, status: "active" },
        };

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          tasks: [taskWithResult],
        };

        const result = await checkPaymentNode(state as DeployGraphState);

        const task = result.tasks?.find((t) => t.name === "CheckingBilling");
        expect(task?.status).toBe("completed");
      });

      it("marks task completed when webhook returns has_payment: false", async () => {
        // Note: has_payment: false is still a valid completed state
        // The task completed successfully, it just found no payment
        const taskWithResult: Deploy.Task = {
          ...Deploy.createTask("CheckingBilling"),
          status: "running",
          jobId: 123,
          result: { has_payment: false, status: "none" },
        };

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          tasks: [taskWithResult],
        };

        const result = await checkPaymentNode(state as DeployGraphState);

        const task = result.tasks?.find((t) => t.name === "CheckingBilling");
        expect(task?.status).toBe("completed");
      });

      it("marks task failed when webhook returns error", async () => {
        const taskWithError: Deploy.Task = {
          ...Deploy.createTask("CheckingBilling"),
          status: "running",
          jobId: 123,
          error: "Google Ads API error: AUTHENTICATION_ERROR",
        };

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          tasks: [taskWithError],
        };

        const result = await checkPaymentNode(state as DeployGraphState);

        const task = result.tasks?.find((t) => t.name === "CheckingBilling");
        expect(task?.status).toBe("failed");
      });
    });

    describe("Validation Errors", () => {
      it("throws error when JWT is missing", async () => {
        const state: Partial<DeployGraphState> = {
          jwt: undefined,
          threadId: "thread_123" as ThreadIDType,
          tasks: [],
        };

        await expect(checkPaymentNode(state as DeployGraphState)).rejects.toThrow(
          "JWT token is required"
        );
      });

      it("throws error when threadId is missing", async () => {
        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: undefined,
          tasks: [],
        };

        await expect(checkPaymentNode(state as DeployGraphState)).rejects.toThrow(
          "Thread ID is required"
        );
      });
    });
  });

  /**
   * =============================================================================
   * 8. SHOULD CHECK PAYMENT ROUTING TESTS [campaign]
   * =============================================================================
   * Tests for the shouldCheckPayment conditional routing function.
   */
  describe("shouldCheckPayment - Conditional Routing", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns 'skipCheckPayment' when CheckingBilling task is completed", async () => {
      const completedTask: Deploy.Task = {
        ...Deploy.createTask("CheckingBilling"),
        status: "completed",
      };

      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        tasks: [completedTask],
      };

      const result = await shouldCheckPayment(state as DeployGraphState);

      expect(result).toBe("skipCheckPayment");
    });

    it("returns 'skipCheckPayment' when API says payment is verified", async () => {
      mockGoogleAPIService.mockImplementation(
        () =>
          ({
            getPaymentStatus: vi.fn().mockResolvedValue({ has_payment: true }),
          }) as any
      );

      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        tasks: [],
      };

      const result = await shouldCheckPayment(state as DeployGraphState);

      expect(result).toBe("skipCheckPayment");
    });

    it("returns 'checkPayment' when API says no payment configured", async () => {
      mockGoogleAPIService.mockImplementation(
        () =>
          ({
            getPaymentStatus: vi.fn().mockResolvedValue({ has_payment: false }),
          }) as any
      );

      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        tasks: [],
      };

      const result = await shouldCheckPayment(state as DeployGraphState);

      expect(result).toBe("checkPayment");
    });

    it("returns 'checkPayment' when JWT is missing (cannot verify)", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: undefined,
        tasks: [],
      };

      const result = await shouldCheckPayment(state as DeployGraphState);

      expect(result).toBe("checkPayment");
    });
  });

  /**
   * =============================================================================
   * 9. ENABLE CAMPAIGN NODE TESTS [campaign]
   * =============================================================================
   * Tests for the enableCampaignNode which enables a Google Ads campaign
   * for serving after payment has been verified.
   */
  describe("enableCampaignNode - Campaign Enabling", () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: vi.fn().mockResolvedValue({ id: 789, status: "pending" }),
          }) as any
      );
    });

    describe("Idempotency", () => {
      it("returns {} when task is already completed", async () => {
        const completedTask: Deploy.Task = {
          ...Deploy.createTask("EnablingCampaign"),
          status: "completed",
          result: { enabled: true, campaign_id: 123 },
        };

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 123,
          tasks: [completedTask],
        };

        const result = await enableCampaignNode(state as DeployGraphState);

        expect(result).toEqual({});
      });

      it("returns {} when task is already failed", async () => {
        const failedTask: Deploy.Task = {
          ...Deploy.createTask("EnablingCampaign"),
          status: "failed",
          error: "Campaign enable failed",
        };

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 123,
          tasks: [failedTask],
        };

        const result = await enableCampaignNode(state as DeployGraphState);

        expect(result).toEqual({});
      });

      it("returns {} when task is running and waiting for webhook", async () => {
        const runningTask: Deploy.Task = {
          ...Deploy.createTask("EnablingCampaign"),
          status: "running",
          jobId: 456,
        };

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 123,
          tasks: [runningTask],
        };

        const result = await enableCampaignNode(state as DeployGraphState);

        expect(result).toEqual({});
      });
    });

    describe("First Invocation - Fire and Forget", () => {
      it("creates JobRun with campaign_id and returns task with jobId", async () => {
        const mockCreate = vi.fn().mockResolvedValue({ id: 789, status: "pending" });
        mockJobRunAPIService.mockImplementation(() => ({ create: mockCreate }) as any);

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 123,
          tasks: [],
        };

        const result = await enableCampaignNode(state as DeployGraphState);

        // Verify JobRun was created with campaign_id
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            jobClass: "CampaignEnable",
            arguments: { campaign_id: 123 },
            threadId: "thread_123",
          })
        );

        // Verify task was created with jobId
        expect(result.tasks).toBeDefined();
        const task = result.tasks?.find((t) => t.name === "EnablingCampaign");
        expect(task).toBeDefined();
        expect(task?.status).toBe("running");
        expect(task?.jobId).toBe(789);
      });

      it("includes deployId in JobRun when present", async () => {
        const mockCreate = vi.fn().mockResolvedValue({ id: 789, status: "pending" });
        mockJobRunAPIService.mockImplementation(() => ({ create: mockCreate }) as any);

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 123,
          deployId: 456,
          tasks: [],
        };

        await enableCampaignNode(state as DeployGraphState);

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            deployId: 456,
          })
        );
      });
    });

    describe("Webhook Result Processing", () => {
      it("marks task completed when webhook returns enabled: true", async () => {
        const taskWithResult: Deploy.Task = {
          ...Deploy.createTask("EnablingCampaign"),
          status: "running",
          jobId: 456,
          result: { enabled: true, campaign_id: 123 },
        };

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 123,
          tasks: [taskWithResult],
        };

        const result = await enableCampaignNode(state as DeployGraphState);

        const task = result.tasks?.find((t) => t.name === "EnablingCampaign");
        expect(task?.status).toBe("completed");
      });

      it("marks task completed when campaign was already enabled", async () => {
        const taskWithResult: Deploy.Task = {
          ...Deploy.createTask("EnablingCampaign"),
          status: "running",
          jobId: 456,
          result: { enabled: true, campaign_id: 123, already_enabled: true },
        };

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 123,
          tasks: [taskWithResult],
        };

        const result = await enableCampaignNode(state as DeployGraphState);

        const task = result.tasks?.find((t) => t.name === "EnablingCampaign");
        expect(task?.status).toBe("completed");
      });

      it("marks task failed when webhook returns error", async () => {
        const taskWithError: Deploy.Task = {
          ...Deploy.createTask("EnablingCampaign"),
          status: "running",
          jobId: 456,
          error: "Campaign enable failed: BILLING_NOT_CONFIGURED",
        };

        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 123,
          tasks: [taskWithError],
        };

        const result = await enableCampaignNode(state as DeployGraphState);

        const task = result.tasks?.find((t) => t.name === "EnablingCampaign");
        expect(task?.status).toBe("failed");
      });
    });

    describe("Validation Errors", () => {
      it("throws error when JWT is missing", async () => {
        const state: Partial<DeployGraphState> = {
          jwt: undefined,
          threadId: "thread_123" as ThreadIDType,
          campaignId: 123,
          tasks: [],
        };

        await expect(enableCampaignNode(state as DeployGraphState)).rejects.toThrow(
          "JWT token is required"
        );
      });

      it("throws error when threadId is missing", async () => {
        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: undefined,
          campaignId: 123,
          tasks: [],
        };

        await expect(enableCampaignNode(state as DeployGraphState)).rejects.toThrow(
          "Thread ID is required"
        );
      });

      it("throws error when campaignId is missing", async () => {
        const state: Partial<DeployGraphState> = {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: undefined,
          tasks: [],
        };

        await expect(enableCampaignNode(state as DeployGraphState)).rejects.toThrow(
          "Campaign ID is required"
        );
      });
    });
  });

  /**
   * =============================================================================
   * 10. PAYMENT AND ENABLE CAMPAIGN FLOW INTEGRATION TESTS [campaign]
   * =============================================================================
   * Tests for the full checkPayment -> enableCampaign flow in the deploy graph.
   */
  describe("Deploy Graph - Payment and Enable Campaign Flow", () => {
    beforeEach(() => {
      vi.clearAllMocks();

      // Default: Google connected, invite accepted, payment configured
      mockGoogleAPIService.mockImplementation(
        () =>
          ({
            getConnectionStatus: vi
              .fn()
              .mockResolvedValue({ connected: true, email: "user@gmail.com" }),
            getInviteStatus: vi
              .fn()
              .mockResolvedValue({ accepted: true, status: "accepted", email: "user@gmail.com" }),
            getPaymentStatus: vi.fn().mockResolvedValue({ has_payment: true }),
          }) as any
      );

      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: vi.fn().mockResolvedValue({ id: 123, status: "pending" }),
          }) as any
      );
    });

    // Helper: All tasks needed to be completed before campaign flow
    const completedWebsiteTasks = [
      { ...Deploy.createTask("ConnectingGoogle"), status: "completed" as const },
      { ...Deploy.createTask("VerifyingGoogle"), status: "completed" as const },
      { ...Deploy.createTask("AddingAnalytics"), status: "completed" as const },
      { ...Deploy.createTask("OptimizingSEO"), status: "completed" as const },
      { ...Deploy.createTask("ValidateLinks"), status: "completed" as const },
      { ...Deploy.createTask("RuntimeValidation"), status: "completed" as const },
      { ...Deploy.createTask("DeployingWebsite"), status: "completed" as const },
    ];

    it("skips checkPayment when payment is already verified", async () => {
      // Payment is verified via API mock above
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: 123,
          deploy: { googleAds: true },
          tasks: [
            ...completedWebsiteTasks,
            { ...Deploy.createTask("DeployingCampaign"), status: "completed" },
          ],
        })
        .stopAfter("enqueueEnableCampaign")
        .execute();

      // Should NOT have CheckingBilling task (skipped)
      const checkPaymentTask = result.state.tasks.find((t) => t.name === "CheckingBilling");
      expect(checkPaymentTask).toBeUndefined();

      // Should have EnablingCampaign task (proceeded directly)
      const enableTask = result.state.tasks.find((t) => t.name === "EnablingCampaign");
      expect(enableTask).toBeDefined();
    });

    it("runs checkPayment when payment is not verified", async () => {
      // Payment NOT verified
      mockGoogleAPIService.mockImplementation(
        () =>
          ({
            getConnectionStatus: vi
              .fn()
              .mockResolvedValue({ connected: true, email: "user@gmail.com" }),
            getInviteStatus: vi
              .fn()
              .mockResolvedValue({ accepted: true, status: "accepted", email: "user@gmail.com" }),
            getPaymentStatus: vi.fn().mockResolvedValue({ has_payment: false }),
          }) as any
      );

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: 123,
          deploy: { googleAds: true },
          tasks: [
            ...completedWebsiteTasks,
            { ...Deploy.createTask("DeployingCampaign"), status: "completed" },
          ],
        })
        .stopAfter("checkPayment")
        .execute();

      // Should have CheckingBilling task
      const checkPaymentTask = result.state.tasks.find((t) => t.name === "CheckingBilling");
      expect(checkPaymentTask).toBeDefined();
      expect(checkPaymentTask?.status).toBe("running");
    });

    it("proceeds to enableCampaign after checkPayment completes", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: 123,
          deploy: { googleAds: true },
          tasks: [
            ...completedWebsiteTasks,
            { ...Deploy.createTask("DeployingCampaign"), status: "completed" },
            {
              ...Deploy.createTask("CheckingBilling"),
              status: "completed",
              result: { has_payment: true },
            },
          ],
        })
        .stopAfter("enableCampaign")
        .execute();

      // Should have EnablingCampaign task
      const enableTask = result.state.tasks.find((t) => t.name === "EnablingCampaign");
      expect(enableTask).toBeDefined();
      expect(enableTask?.status).toBe("running");
    });

    it("graph ends after enableCampaign completes", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: 123,
          deploy: { googleAds: true },
          tasks: [
            ...completedWebsiteTasks,
            { ...Deploy.createTask("DeployingCampaign"), status: "completed" },
            {
              ...Deploy.createTask("CheckingBilling"),
              status: "completed",
              result: { has_payment: true },
            },
            {
              ...Deploy.createTask("EnablingCampaign"),
              status: "completed",
              result: { enabled: true, campaign_id: 123 },
            },
          ],
        })
        .execute();

      // Graph should complete - all campaign tasks done
      const enableTask = result.state.tasks.find((t) => t.name === "EnablingCampaign");
      expect(enableTask?.status).toBe("completed");
    });
  });
});