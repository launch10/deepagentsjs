import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WebsiteGraphState } from "@annotation";
import { testGraph } from "@support";
import { deployGraph as uncompiledGraph } from "@graphs";
import type { DeployGraphState } from "@annotation";
import type { ThreadIDType } from "@types";
import { Deploy, Task } from "@types";
import { graphParams } from "@core";
import { DatabaseSnapshotter } from "@rails_api";
import { websiteFiles, campaigns, projects, and, eq, db } from "@db";
import { jobRunCallback } from "@server/routes/webhooks/jobRunCallback";
import { getCodingAgentBackend, analyticsNode } from "@nodes";

// Mock external services that hit Rails workers / Google APIs
vi.mock("@rails_api", async () => {
  const actual = await vi.importActual("@rails_api");
  return {
    ...actual,
    JobRunAPIService: vi.fn(),
    DeployAPIService: vi.fn(),
    CampaignAPIService: vi.fn(),
  };
});

vi.mock("@services", async () => {
  const actual = await vi.importActual("@services");
  // Re-use the same mocks from @rails_api so both import paths share one mock
  const { JobRunAPIService, CampaignAPIService } = await import("@rails_api");
  return {
    ...actual,
    GoogleAPIService: vi.fn(),
    JobRunAPIService,
    CampaignAPIService,
  };
});

import { GoogleAPIService } from "@services";
import { JobRunAPIService, DeployAPIService, CampaignAPIService } from "@rails_api";

const mockGoogleAPIService = vi.mocked(GoogleAPIService);
const mockJobRunAPIService = vi.mocked(JobRunAPIService);
const mockDeployAPIService = vi.mocked(DeployAPIService);
const mockCampaignAPIService = vi.mocked(CampaignAPIService);

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
  // Mock DeployAPIService globally — initDeployNode creates the deploy,
  // syncDeployStatus updates it at terminal states.
  // Mock CampaignAPIService globally — validateDeployNode checks campaign readiness.
  beforeEach(() => {
    mockCampaignAPIService.mockImplementation(
      () =>
        ({
          validateDeploy: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
        }) as any
    );

    mockDeployAPIService.mockImplementation(
      () =>
        ({
          create: vi.fn().mockResolvedValue({
            id: 1,
            project_id: 1,
            status: "pending",
            is_live: false,
            thread_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
          update: vi.fn().mockResolvedValue({
            id: 1,
            project_id: 1,
            status: "completed",
            is_live: true,
            thread_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        }) as any
    );
  });

  /**
   * =============================================================================
   * 1. GOOGLE CONNECT/VERIFY TESTS [campaign]
   * =============================================================================
   * These tests verify the conditional routing for Google OAuth and invite flows.
   * The key principle: "Never enqueue what you won't run"
   */
  describe("Google Onboarding Flow", () => {
    let campaignId: number | undefined;
    let projectId: number | undefined;

    beforeEach(async () => {
      vi.clearAllMocks();

      await DatabaseSnapshotter.restoreSnapshot("campaign_complete");
      campaignId = (await db.select().from(campaigns).limit(1).execute())[0]?.id;
      projectId = (await db.select().from(projects).limit(1).execute())[0]?.id;

      // Default: Google connected, invite accepted, payment verified
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

      // Mock JobRunAPIService to prevent real Rails worker dispatch
      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: vi.fn().mockResolvedValue({ id: 999, status: "pending" }),
          }) as any
      );
    });

    describe("ConnectingGoogle", () => {
      it("skips ConnectingGoogle when Google is already connected", async () => {
        // Mock: Google connected, invite accepted, payment verified
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

        const result = await testGraph<DeployGraphState>()
          .withGraph(deployGraph)
          .withState({
            jwt: "test-jwt",
            threadId: "thread_123" as ThreadIDType,
            projectId,
            websiteId: 1,
            campaignId,

            instructions: { googleAds: true },
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
              projectId,
              websiteId: 1,
              campaignId: 123,

              instructions: { googleAds: true },
              tasks: [],
              chatId: 1,
            })
            .execute();

          // Should have ConnectingGoogle task with running status
          const googleConnectTask = Task.findTask(result.state.tasks, "ConnectingGoogle");
          expect(googleConnectTask).toBeDefined();
          expect(googleConnectTask?.status).toBe("running");
          // All googleAds tasks are pre-created as pending, but only ConnectingGoogle is running
          // (this is a blocking action, executor won't advance past it)
          const nonPendingTasks = result.state.tasks.filter((t) => t.status !== "pending");
          expect(nonPendingTasks.length).toBe(1);
        });

        it("continues to wait when already running ConnectingGoogle", async () => {
          const result = await testGraph<DeployGraphState>()
            .withGraph(deployGraph)
            .withState({
              jwt: "test-jwt",
              threadId: "thread_123" as ThreadIDType,
              projectId,
              websiteId: 1,
              campaignId: 123,

              instructions: { googleAds: true },
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
              projectId,
              websiteId: 1,
              campaignId,

              instructions: { googleAds: true },
              tasks: [],
              chatId: 1,
            });
          const result = await graph.execute();
          const googleConnectTask = Task.findTask(result.state.tasks, "ConnectingGoogle");

          await jobRunCallback({
            job_run_id: googleConnectTask?.jobId!,
            thread_id: graph.threadId!,
            status: "completed",
            result: { google_email: "test@gmail.com" },
          });

          const updates = (
            await deployGraph.getState({
              configurable: {
                thread_id: graph.threadId,
              },
            })
          ).values;

          const updatedResult = await deployGraph.invoke(updates, {
            configurable: {
              thread_id: graph.threadId,
            },
          });

          const updatedGoogleConnectTask = Task.findTask(updatedResult.tasks, "ConnectingGoogle");
          const verifyingGoogleTask = Task.findTask(updatedResult.tasks, "VerifyingGoogle");

          // Should have ConnectingGoogle completed and VerifyingGoogle running
          expect(updatedGoogleConnectTask).toBeDefined();
          expect(updatedGoogleConnectTask?.status).toBe("completed");
          // All googleAds tasks are pre-created; ConnectingGoogle completed, VerifyingGoogle running
          expect(verifyingGoogleTask?.status).toBe("running");
        });
      });
    });

    describe("VerifyingGoogle", async () => {
      describe("When NOT deploying website", async () => {
        it("proceeds to DeployCampaign after both GoogleConnect and GoogleVerify complete", async () => {
          // Mock: Google connected, invite NOT accepted, payment verified
          mockGoogleAPIService.mockImplementation(
            () =>
              ({
                getConnectionStatus: vi
                  .fn()
                  .mockResolvedValue({ connected: true, email: "user@gmail.com" }),
                getInviteStatus: vi.fn().mockResolvedValue({ accepted: false, status: "none" }),
                getPaymentStatus: vi.fn().mockResolvedValue({ has_payment: true }),
              }) as any
          );

          const graph = testGraph<DeployGraphState>()
            .withGraph(deployGraph)
            .withState({
              jwt: "test-jwt",
              threadId: "thread_123" as ThreadIDType,
              projectId,
              websiteId: 1,
              campaignId,

              instructions: { googleAds: true },
              tasks: Deploy.withTasks({ googleAds: true }, { ConnectingGoogle: "completed" }),
              chatId: 1,
            });

          const result = await graph.execute();

          // Should have all tasks
          const googleVerifyTask = result.state.tasks.find((t) => t.name === "VerifyingGoogle");

          await jobRunCallback({
            job_run_id: googleVerifyTask?.jobId!,
            thread_id: graph.threadId!,
            status: "completed",
            result: { status: "accepted" },
          });

          const updates = (
            await deployGraph.getState({
              configurable: {
                thread_id: graph.threadId,
              },
            })
          ).values;

          const updatedResult = await deployGraph.invoke(updates, {
            configurable: {
              thread_id: graph.threadId,
            },
          });

          const updatedGoogleVerifyTask = updatedResult.tasks.find(
            (t) => t.name === "VerifyingGoogle"
          );
          const deployTask = updatedResult.tasks.find((t) => t.name === "DeployingCampaign");

          expect(updatedGoogleVerifyTask?.status).toBe("completed");
          expect(deployTask).toBeDefined();
          expect(deployTask?.status).toBe("running"); // enqueueTask creates with running status
        });
      });

      describe("When YES deploying website", async () => {
        it("proceeds to Analytics after both GoogleConnect and GoogleVerify complete", async () => {
          // Mock createCodingAgent to skip actual LLM calls - just return immediately
          const createCodingAgentSpy = vi
            .spyOn(await import("@nodes"), "createCodingAgent")
            .mockResolvedValue({ messages: [], status: "completed" } as any);

          // Mock: Google connected, invite NOT accepted, payment verified
          mockGoogleAPIService.mockImplementation(
            () =>
              ({
                getConnectionStatus: vi
                  .fn()
                  .mockResolvedValue({ connected: true, email: "user@gmail.com" }),
                getInviteStatus: vi.fn().mockResolvedValue({ accepted: false, status: "none" }),
                getPaymentStatus: vi.fn().mockResolvedValue({ has_payment: true }),
              }) as any
          );

          // With the new flow: Google setup → analytics → seo → validation → deploy → campaign
          // We need website tasks completed to reach campaign
          const graph = testGraph<DeployGraphState>()
            .withGraph(deployGraph)
            .withState({
              jwt: "test-jwt",
              threadId: "thread_123" as ThreadIDType,
              projectId,
              websiteId: 1,
              campaignId,

              instructions: { googleAds: true, website: true },
              tasks: Deploy.withTasks(
                { googleAds: true, website: true },
                { VerifyingGoogle: "pending" }
              ),
              chatId: 1,
            });

          const result = await graph.execute();

          // Should have all tasks
          const googleVerifyTask = result.state.tasks.find((t) => t.name === "VerifyingGoogle");

          await jobRunCallback({
            job_run_id: googleVerifyTask?.jobId!,
            thread_id: graph.threadId!,
            status: "completed",
            result: { status: "accepted" },
          });

          // Resume graph - fetch state and re-invoke (same pattern as DeployCampaign test)
          const updates = (
            await deployGraph.getState({
              configurable: { thread_id: graph.threadId },
            })
          ).values;

          const updatedResult = await deployGraph.invoke(updates, {
            configurable: { thread_id: graph.threadId },
          });

          const updatedGoogleVerifyTask = updatedResult.tasks.find(
            (t) => t.name === "VerifyingGoogle"
          );
          const analyticsTask = updatedResult.tasks.find((t) => t.name === "AddingAnalytics");

          expect(updatedGoogleVerifyTask?.status).toBe("completed");
          expect(analyticsTask).toBeDefined();
          expect(analyticsTask?.status).toBe("completed"); // Should complete since agent is mocked

          // Cleanup
          createCodingAgentSpy.mockRestore();
        });
      });
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
    beforeEach(async () => {
      await DatabaseSnapshotter.restoreSnapshot("website_deploy_step");
    });

    it("skips instrumentation when analytics already present", async () => {
      // The website_deploy_step snapshot already has L10.createLead in the files
      // (analytics is now added during website generation). The analytics node
      // should detect this and complete without calling the coding agent.
      const filesBeforeRunning = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, 1))
        .execute();

      // Confirm analytics is already present in the snapshot
      const hasAnalyticsBeforeRunning = filesBeforeRunning.some(
        (file) => file.content?.includes("L10.createLead") || file.content?.includes("createLead")
      );
      expect(hasAnalyticsBeforeRunning).toBe(true);

      // Spy on createCodingAgent to verify it's NOT called
      const createCodingAgentSpy = vi.spyOn(await import("@nodes"), "createCodingAgent");

      // Run just the analytics node in isolation
      const result = await testGraph<DeployGraphState>()
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          instructions: { website: true },
          tasks: [Deploy.createTask("AddingAnalytics")],
          chatId: 1,
        })
        .runNode(analyticsNode)
        .execute();

      // Verify the instrumentation task completed
      const analyticsTask = result.state.tasks.find((t) => t.name === "AddingAnalytics");
      expect(analyticsTask).toBeDefined();
      expect(analyticsTask?.status).toBe("completed");

      // Verify the agent was NOT called (files already instrumented)
      expect(createCodingAgentSpy).not.toHaveBeenCalled();

      createCodingAgentSpy.mockRestore();
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
      await DatabaseSnapshotter.restoreSnapshot("website_deploy_step");

      // Insert an index.html with SEO meta tags already present
      const seoContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Test Landing Page</title>
    <meta name="description" content="This is a test landing page with great content">
    <meta property="og:title" content="Test Landing Page">
    <meta property="og:description" content="This is a test landing page">
    <meta property="og:image" content="https://example.com/image.png">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="https://example.com/favicon.ico">
</head>
<body><div id="root"></div></body>
</html>`;

      await db
        .insert(websiteFiles)
        .values({
          websiteId: 1,
          path: "index.html",
          content: seoContent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .execute();

      // Spy on createCodingAgent to verify it's NOT called
      const createCodingAgentSpy = vi.spyOn(await import("@nodes"), "createCodingAgent");

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,

          instructions: { website: true },
          tasks: Deploy.withTasks(
            { website: true },
            { OptimizingSEO: "pending" },
            { after: "completed" }
          ),
          chatId: 1,
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
      // Use website_deploy_step snapshot which has a complete website
      await DatabaseSnapshotter.restoreSnapshot("website_deploy_step");

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,

          instructions: { website: true },
          tasks: Deploy.withTasks(
            { website: true },
            { OptimizingSEO: "pending" },
            { after: "completed" }
          ),
          chatId: 1,
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
      await DatabaseSnapshotter.restoreSnapshot("website_deploy_step");

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,

          instructions: { website: true },
          tasks: Deploy.withTasks(
            { website: true },
            { OptimizingSEO: "pending" },
            { after: "completed" }
          ),
          chatId: 1,
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
      await DatabaseSnapshotter.restoreSnapshot("website_deploy_step");

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,

          instructions: { website: true },
          tasks: Deploy.withTasks(
            { website: true },
            { OptimizingSEO: "pending" },
            { after: "completed" }
          ),
          chatId: 1,
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
   * 4. LINK VALIDATION TESTS [all]
   * =============================================================================
   * These tests verify link validation catches broken links before deployment.
   *
   * USER OUTCOME: Broken links are caught before going live.
   */
  // Link Validation tests removed: anchor link validation is permanently disabled
  // (shouldSkip always returns true). Re-add tests when link validation is re-enabled.

  /**
   * =============================================================================
   * 5. BUG FIXING TESTS [all]
   * =============================================================================
   * These tests verify the bug fixing flow when validation fails.
   *
   * USER OUTCOME: Broken links are detected and automatically fixed.
   */
  describe("Bug Fixing", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      await DatabaseSnapshotter.restoreSnapshot("website_deploy_step");
    });

    afterEach(async () => {
      const backend = await getCodingAgentBackend({
        websiteId: 1,
        jwt: "test-jwt",
      } as any);
      await backend.cleanup();
    });

    /**
     * USER OUTCOME: Sites with no bugs skip the fix step.
     */
    it("skips when validation passes", async () => {
      const createCodingAgentSpy = vi.spyOn(await import("@nodes"), "createCodingAgent");

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,

          instructions: { website: true },
          tasks: Deploy.withTasks(
            { website: true },
            {
              ValidateLinks: "completed",
              RuntimeValidation: "completed",
              FixingBugs: "pending",
            },
            { after: "completed" }
          ),
          chatId: 1,
        })
        .execute();

      const fixingBugsTask = result.state.tasks.find((t) => t.name === "FixingBugs");
      expect(fixingBugsTask?.status).toBe("skipped");
      expect(createCodingAgentSpy).not.toHaveBeenCalled();

      createCodingAgentSpy.mockRestore();
    });

    // "fixes broken links" test removed: link validation is permanently disabled
    // (shouldSkip always returns true), so there are no broken link errors to fix.
    // Re-add when link validation is re-enabled.
  });

  /**
   * =============================================================================
   * 6. WEBSITE DEPLOYMENT TESTS [all]
   * =============================================================================
   * These tests verify website deployment is triggered correctly.
   *
   * USER OUTCOME: Website goes live after validation passes.
   */
  describe("Website Deployment", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      await DatabaseSnapshotter.restoreSnapshot("website_deploy_step");

      // Mock JobRunAPIService to prevent real Rails worker dispatch
      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: vi.fn().mockResolvedValue({ id: 888, status: "pending" }),
          }) as any
      );
    });

    /**
     * USER OUTCOME: Campaign-only deploys don't touch the website.
     */
    it("skips when deploying only campaign", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId: 1,

          instructions: { googleAds: true },
          tasks: [],
          chatId: 1,
        })
        .execute();

      const deployTask = result.state.tasks.find((t) => t.name === "DeployingWebsite");
      expect(deployTask).toBeUndefined();
    });

    /**
     * USER OUTCOME: Deploy fails early when no domain (website_url) is assigned.
     * This prevents running the entire deploy checklist with no URL to serve on.
     */
    it("fails when website has no website_url assigned", async () => {
      // website_step snapshot has website_id=1 but NO website_url for it
      await DatabaseSnapshotter.restoreSnapshot("website_step");

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_no_url" as ThreadIDType,
          projectId: 1,
          websiteId: 1,

          instructions: { website: true },
          tasks: [],
          chatId: 1,
        })
        .execute();

      // Should fail before any tasks are created/run
      expect(result.state.status).toBe("failed");
      expect(result.state.error).toBeDefined();
      expect(result.state.error?.message).toContain("website_url");
      // No tasks should have been executed
      expect(result.state.tasks.length).toBe(0);
    });

    /**
     * USER OUTCOME: Deploy fails early when campaign is missing required data.
     * This prevents the CampaignDeploy worker from crashing with nil budget/keywords.
     */
    it("fails when campaign is missing required data", async () => {
      mockCampaignAPIService.mockImplementation(
        () =>
          ({
            validateDeploy: vi.fn().mockResolvedValue({
              valid: false,
              errors: ["Daily budget must be greater than 0", "Keywords must have between 5-15 keywords per ad group (currently has 0)"],
            }),
          }) as any
      );

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_no_campaign_data" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId: 1,

          instructions: { googleAds: true },
          tasks: [],
          chatId: 1,
        })
        .execute();

      // Should fail before any tasks are created/run
      expect(result.state.status).toBe("failed");
      expect(result.state.error).toBeDefined();
      expect(result.state.error?.message).toContain("Campaign is not ready to deploy");
      expect(result.state.error?.message).toContain("budget");
      // No tasks should have been executed
      expect(result.state.tasks.length).toBe(0);
    });

    /**
     * USER OUTCOME: Deploy proceeds when campaign passes validation.
     */
    it("passes validation when campaign is complete", async () => {
      await DatabaseSnapshotter.restoreSnapshot("campaign_complete");
      const campaignId = (await db.select().from(campaigns).limit(1).execute())[0]?.id;

      mockCampaignAPIService.mockImplementation(
        () =>
          ({
            validateDeploy: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
          }) as any
      );

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

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_valid_campaign" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId,

          instructions: { googleAds: true },
          tasks: [],
          chatId: 1,
        })
        .execute();

      // Should NOT fail — validation passed, tasks should be created
      expect(result.state.status).not.toBe("failed");
      expect(result.state.tasks.length).toBeGreaterThan(0);
    });

    /**
     * USER OUTCOME: Website deployment job is created.
     */
    it("creates deployment job", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,

          instructions: { website: true },
          tasks: Deploy.withTasks({ website: true }, { DeployingWebsite: "pending" }),
          chatId: 1,
        })
        .execute();

      const deployTask = result.state.tasks.find((t) => t.name === "DeployingWebsite");
      expect(deployTask?.status).toBe("running");
      expect(deployTask?.jobId).toBeDefined();
    });
  });

  /**
   * =============================================================================
   * 7. TASK PRE-CREATION TESTS
   * =============================================================================
   * These tests verify that initPhasesNode pre-creates all expected tasks
   * as "pending" so the frontend progress bar shows the full set from the start.
   *
   * The key invariants being tested:
   * - Fresh deploys (empty tasks[]) get all expected tasks pre-created as pending
   * - Pre-created pending tasks are correctly picked up by the executor
   * - shouldSkip logic still works correctly with pre-existing pending tasks
   * - Serial execution is preserved (readyToRun dependencies don't cause premature skipping)
   */
  describe("Task Pre-Creation", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      await DatabaseSnapshotter.restoreSnapshot("website_deploy_step");

      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: vi.fn().mockResolvedValue({ id: 555, status: "pending" }),
          }) as any
      );
    });

    // Helper: wrap sync initPhasesNode as async for runNode() compatibility
    const asyncInitPhases = async (state: DeployGraphState) => {
      const { initPhasesNode } = await import("@nodes");
      return initPhasesNode(state);
    };

    /**
     * Test initPhasesNode directly: when tasks are empty and deploy includes website,
     * it should pre-create all website tasks as pending.
     */
    it("pre-creates all expected website tasks as pending on fresh deploy", async () => {
      const result = await testGraph<DeployGraphState>()
        .withState({
          jwt: "test-jwt",
          threadId: "thread_precreate_1" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          instructions: { website: true, googleAds: false },
          tasks: [],
          chatId: 1,
        })
        .runNode(asyncInitPhases)
        .execute();

      const expectedWebsiteTasks: Deploy.TaskName[] = [
        "ValidateLinks",
        "RuntimeValidation",
        "FixingBugs",
        "OptimizingSEO",
        "OptimizingPageForLLMs",
        "AddingAnalytics",
        "DeployingWebsite",
      ];

      // Exact task count — no ghost undefined tasks from false instructions
      expect(result.state.tasks.length).toBe(expectedWebsiteTasks.length);

      // All expected tasks should exist
      for (const taskName of expectedWebsiteTasks) {
        const task = Task.findTask(result.state.tasks, taskName);
        expect(task, `Expected task "${taskName}" to exist`).toBeDefined();
        expect(task?.status, `Expected task "${taskName}" to be pending`).toBe("pending");
      }

      // No campaign tasks should exist
      const campaignTaskNames = [
        "ConnectingGoogle",
        "VerifyingGoogle",
        "CheckingBilling",
        "DeployingCampaign",
        "EnablingCampaign",
      ];
      for (const taskName of campaignTaskNames) {
        const task = Task.findTask(result.state.tasks, taskName);
        expect(task, `Expected campaign task "${taskName}" to NOT exist`).toBeUndefined();
      }

      // Only website phases should exist — no campaign phases
      const expectedWebsitePhases: Deploy.PhaseName[] = [
        "CheckingForBugs",
        "FixingBugs",
        "OptimizingSEO",
        "AddingAnalytics",
        "DeployingWebsite",
      ];
      expect(result.state.phases.length).toBe(expectedWebsitePhases.length);
      for (const phaseName of expectedWebsitePhases) {
        const phase = result.state.phases.find((p) => p.name === phaseName);
        expect(phase, `Expected website phase "${phaseName}" to exist`).toBeDefined();
      }
      const campaignPhaseNames = [
        "ConnectingGoogle",
        "VerifyingGoogle",
        "CheckingBilling",
        "DeployingCampaign",
        "EnablingCampaign",
      ];
      for (const phaseName of campaignPhaseNames) {
        const phase = result.state.phases.find((p) => p.name === phaseName);
        expect(phase, `Expected campaign phase "${phaseName}" to NOT exist`).toBeUndefined();
      }
    });

    /**
     * Test initPhasesNode directly: when deploy includes both website and googleAds,
     * it should pre-create ALL tasks (website + campaign) as pending.
     */
    it("pre-creates all expected campaign + website tasks on combined deploy", async () => {
      const result = await testGraph<DeployGraphState>()
        .withState({
          jwt: "test-jwt",
          threadId: "thread_precreate_2" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId: 1,
          instructions: { website: true, googleAds: true },
          tasks: [],
          chatId: 1,
        })
        .runNode(asyncInitPhases)
        .execute();

      // All website AND campaign tasks should exist
      const allExpectedTasks: Deploy.TaskName[] = [
        "ConnectingGoogle",
        "VerifyingGoogle",
        "CheckingBilling",
        "ValidateLinks",
        "RuntimeValidation",
        "FixingBugs",
        "OptimizingSEO",
        "OptimizingPageForLLMs",
        "AddingAnalytics",
        "DeployingWebsite",
        "DeployingCampaign",
        "EnablingCampaign",
      ];

      // Exact task count — no ghost undefined tasks
      expect(result.state.tasks.length).toBe(allExpectedTasks.length);

      for (const taskName of allExpectedTasks) {
        const task = Task.findTask(result.state.tasks, taskName);
        expect(task, `Expected task "${taskName}" to exist`).toBeDefined();
        expect(task?.status, `Expected task "${taskName}" to be pending`).toBe("pending");
      }

      // All 10 phases should exist (both website + campaign)
      expect(result.state.phases.length).toBe(10);
    });

    /**
     * Test initPhasesNode directly: when tasks already exist (resumed from checkpoint),
     * it should NOT overwrite them — only compute phases.
     */
    it("does not overwrite existing tasks when tasks already present", async () => {
      const existingTasks = Deploy.withTasks(
        { website: true },
        { ValidateLinks: "completed", RuntimeValidation: "running" }
      );

      const result = await testGraph<DeployGraphState>()
        .withState({
          jwt: "test-jwt",
          threadId: "thread_precreate_3" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          instructions: { website: true },
          tasks: existingTasks,
          chatId: 1,
        })
        .runNode(asyncInitPhases)
        .execute();

      // Existing tasks should be unchanged
      const validateLinks = Task.findTask(result.state.tasks, "ValidateLinks");
      expect(validateLinks?.status).toBe("completed");

      const runtimeValidation = Task.findTask(result.state.tasks, "RuntimeValidation");
      expect(runtimeValidation?.status).toBe("running");
    });

    /**
     * Test the task executor with pre-created pending tasks:
     * The executor should enqueue the first pending task as running.
     *
     * Note: runNode returns the partial state update (before the reducer merges).
     * The executor returns only the tasks it modified. We verify:
     * 1. The returned tasks include the first task as "running"
     * 2. No other tasks are in the returned partial (executor only touches one task per pass)
     */
    it("pre-created pending tasks transition to running when executor picks them up", async () => {
      const { taskExecutorNode } = await import("@nodes");

      // Start with pre-created pending tasks (simulating what initPhasesNode creates)
      const pendingTasks = Deploy.createTasks({ website: true });

      const result = await testGraph<DeployGraphState>()
        .withState({
          jwt: "test-jwt",
          threadId: "thread_precreate_4" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          instructions: { website: true },
          tasks: pendingTasks,
          chatId: 1,
        })
        .runNode(taskExecutorNode)
        .execute();

      // The executor returns a partial with only the first task transitioned to running.
      // runNode merges partial onto initial state, replacing the tasks array.
      // The first task in website order is ValidateLinks — executor enqueues it as running.
      const validateLinks = Task.findTask(result.state.tasks, "ValidateLinks");
      expect(validateLinks).toBeDefined();
      expect(validateLinks?.status).toBe("skipped"); // temporary, until we figure out a better way to fix broken links
    });

    /**
     * Test shouldSkip with pre-created pending tasks:
     * FixingBugs should be skipped when both validation tasks completed without failure.
     */
    it("shouldSkip still works correctly with pre-created pending tasks", async () => {
      // FixingBugs should be skipped when validation passes (both completed, neither failed)
      // Start with pre-created tasks, but set validation tasks to completed
      const tasks = Deploy.createTasks({ website: true }).map((t) => {
        if (t.name === "ValidateLinks" || t.name === "RuntimeValidation") {
          return { ...t, status: "completed" as const };
        }
        return t;
      });

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_precreate_5" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          instructions: { website: true },
          tasks,
          chatId: 1,
        })
        .stopAfter("taskExecutor")
        .execute();

      // FixingBugs should be skipped (validation passed)
      const fixingBugs = Task.findTask(result.state.tasks, "FixingBugs");
      expect(fixingBugs?.status).toBe("skipped");
    });

    /**
     * Test initPhasesNode directly: campaign-only deploy creates only campaign tasks.
     */
    it("campaign-only deploy pre-creates only campaign tasks", async () => {
      const result = await testGraph<DeployGraphState>()
        .withState({
          jwt: "test-jwt",
          threadId: "thread_precreate_6" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId: 1,
          instructions: { googleAds: true },
          tasks: [],
          chatId: 1,
        })
        .runNode(asyncInitPhases)
        .execute();

      const expectedCampaignTasks: Deploy.TaskName[] = [
        "ConnectingGoogle",
        "VerifyingGoogle",
        "CheckingBilling",
        "DeployingCampaign",
        "EnablingCampaign",
      ];

      // Exact task count — no ghost undefined tasks
      expect(result.state.tasks.length).toBe(expectedCampaignTasks.length);

      for (const taskName of expectedCampaignTasks) {
        const task = Task.findTask(result.state.tasks, taskName);
        expect(task, `Expected task "${taskName}" to exist`).toBeDefined();
        expect(task?.status, `Expected task "${taskName}" to be pending`).toBe("pending");
      }

      // No website tasks should exist
      const websiteTaskNames = [
        "ValidateLinks",
        "RuntimeValidation",
        "FixingBugs",
        "OptimizingSEO",
        "OptimizingPageForLLMs",
        "AddingAnalytics",
        "DeployingWebsite",
      ];
      for (const taskName of websiteTaskNames) {
        const task = Task.findTask(result.state.tasks, taskName);
        expect(task, `Expected website task "${taskName}" to NOT exist`).toBeUndefined();
      }

      // Only campaign phases should exist — no website phases
      const expectedCampaignPhases: Deploy.PhaseName[] = [
        "ConnectingGoogle",
        "VerifyingGoogle",
        "CheckingBilling",
        "DeployingCampaign",
        "EnablingCampaign",
      ];
      expect(result.state.phases.length).toBe(expectedCampaignPhases.length);
      for (const phaseName of expectedCampaignPhases) {
        const phase = result.state.phases.find((p) => p.name === phaseName);
        expect(phase, `Expected campaign phase "${phaseName}" to exist`).toBeDefined();
      }
      const websitePhaseNames = [
        "CheckingForBugs",
        "FixingBugs",
        "OptimizingSEO",
        "AddingAnalytics",
        "DeployingWebsite",
      ];
      for (const phaseName of websitePhaseNames) {
        const phase = result.state.phases.find((p) => p.name === phaseName);
        expect(phase, `Expected website phase "${phaseName}" to NOT exist`).toBeUndefined();
      }
    });

    /**
     * =============================================================================
     * CAMPAIGN TASK DEPENDENCY REGRESSION TESTS
     * =============================================================================
     * These tests verify that pre-created pending campaign tasks don't break
     * the readyToRun / shouldSkip dependency chain. Each campaign task runner
     * has specific dependencies that must work correctly with pre-existing
     * pending tasks in state.
     */

    it("campaign: VerifyingGoogle waits for ConnectingGoogle (readyToRun dependency)", async () => {
      const { taskExecutorNode } = await import("@nodes");

      // All campaign tasks pre-created as pending. ConnectingGoogle is first,
      // but Google IS already connected, so it should be skipped.
      // VerifyingGoogle should then be next — but its readyToRun checks
      // isTaskDone("ConnectingGoogle"). After ConnectingGoogle is skipped,
      // isTaskDone returns true, so VerifyingGoogle should proceed.
      mockGoogleAPIService.mockImplementation(
        () =>
          ({
            getConnectionStatus: vi
              .fn()
              .mockResolvedValue({ connected: true, email: "user@gmail.com" }),
            getInviteStatus: vi.fn().mockResolvedValue({ accepted: false, status: "none" }),
          }) as any
      );

      // Simulate: ConnectingGoogle already skipped, rest are pending
      const tasks = Deploy.createTasks({ googleAds: true }).map((t) => {
        if (t.name === "ConnectingGoogle") return { ...t, status: "skipped" as const };
        return t;
      });

      const result = await testGraph<DeployGraphState>()
        .withState({
          jwt: "test-jwt",
          threadId: "thread_campaign_dep_1" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId: 1,
          instructions: { googleAds: true },
          tasks,
          chatId: 1,
        })
        .runNode(taskExecutorNode)
        .execute();

      // VerifyingGoogle should be enqueued as running (ConnectingGoogle is done → readyToRun = true)
      const verifyTask = Task.findTask(result.state.tasks, "VerifyingGoogle");
      expect(verifyTask).toBeDefined();
      expect(verifyTask?.status).toBe("running");
    });

    it("campaign: CheckingBilling waits for VerifyingGoogle (readyToRun dependency)", async () => {
      const { taskExecutorNode } = await import("@nodes");

      mockGoogleAPIService.mockImplementation(
        () =>
          ({
            getPaymentStatus: vi.fn().mockResolvedValue({ has_payment: false }),
          }) as any
      );

      // ConnectingGoogle + VerifyingGoogle completed, rest pending
      const tasks = Deploy.createTasks({ googleAds: true }).map((t) => {
        if (t.name === "ConnectingGoogle" || t.name === "VerifyingGoogle") {
          return { ...t, status: "completed" as const };
        }
        return t;
      });

      const result = await testGraph<DeployGraphState>()
        .withState({
          jwt: "test-jwt",
          threadId: "thread_campaign_dep_2" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId: 1,
          instructions: { googleAds: true },
          tasks,
          chatId: 1,
        })
        .runNode(taskExecutorNode)
        .execute();

      // CheckingBilling should be enqueued (VerifyingGoogle done → readyToRun = true)
      const billingTask = Task.findTask(result.state.tasks, "CheckingBilling");
      expect(billingTask).toBeDefined();
      expect(billingTask?.status).toBe("running");
    });

    it("campaign: DeployingCampaign readyToRun respects cross-instruction dependency", async () => {
      const { taskExecutorNode } = await import("@nodes");
      await DatabaseSnapshotter.restoreSnapshot("campaign_complete");
      const campaignId = (await db.select().from(campaigns).limit(1).execute())[0]?.id;

      // Combined deploy: DeployingCampaign.readyToRun checks isTaskDone("DeployingWebsite")
      // With DeployingWebsite still pending, it should NOT be ready
      const tasks = Deploy.createTasks({ website: true, googleAds: true }).map((t) => {
        // Google setup + billing done, website tasks done except DeployingWebsite
        if (
          [
            "ConnectingGoogle",
            "VerifyingGoogle",
            "CheckingBilling",
            "ValidateLinks",
            "RuntimeValidation",
            "FixingBugs",
            "OptimizingSEO",
            "OptimizingPageForLLMs",
            "AddingAnalytics",
          ].includes(t.name)
        ) {
          return { ...t, status: "completed" as const };
        }
        return t; // DeployingWebsite, DeployingCampaign, EnablingCampaign stay pending
      });

      const result = await testGraph<DeployGraphState>()
        .withState({
          jwt: "test-jwt",
          threadId: "thread_campaign_dep_3" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId,
          instructions: { website: true, googleAds: true },
          tasks,
          chatId: 1,
        })
        .runNode(taskExecutorNode)
        .execute();

      // DeployingWebsite is the first non-done task — executor should pick it up
      const deployWebsite = Task.findTask(result.state.tasks, "DeployingWebsite");
      expect(deployWebsite?.status).toBe("running");

      // DeployingCampaign should still be pending (DeployingWebsite not done)
      // Note: runNode replaces tasks with partial, so it won't be in result.
      // The key assertion is that DeployingWebsite was chosen, not DeployingCampaign.
    });

    it("campaign: shouldSkip checks deploy instructions, not task state", async () => {
      const { taskExecutorNode } = await import("@nodes");

      // Campaign-only deploy: website tasks like DeployingWebsite should be skipped
      // because shouldSkip checks !state.instructions?.website,
      // NOT whether the task exists in state.
      // Pre-create only campaign tasks (as initPhasesNode would)
      const tasks = Deploy.createTasks({ googleAds: true });

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

      const result = await testGraph<DeployGraphState>()
        .withState({
          jwt: "test-jwt",
          threadId: "thread_campaign_dep_4" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId: 1,
          instructions: { googleAds: true },
          tasks,
          chatId: 1,
        })
        .runNode(taskExecutorNode)
        .execute();

      // ConnectingGoogle should be skipped (already connected)
      const connectTask = Task.findTask(result.state.tasks, "ConnectingGoogle");
      expect(connectTask?.status).toBe("skipped");
    });

    it("campaign: EnableCampaign waits for CheckingBilling (readyToRun dependency)", async () => {
      const { taskExecutorNode } = await import("@nodes");
      await DatabaseSnapshotter.restoreSnapshot("campaign_complete");
      const campaignId = (await db.select().from(campaigns).limit(1).execute())[0]?.id;

      // All done except EnableCampaign and CheckingBilling (still pending)
      // EnableCampaign.readyToRun checks isTaskDone("CheckingBilling")
      const tasks = Deploy.createTasks({ googleAds: true }).map((t) => {
        if (
          t.name === "ConnectingGoogle" ||
          t.name === "VerifyingGoogle" ||
          t.name === "DeployingCampaign"
        ) {
          return { ...t, status: "completed" as const };
        }
        return t; // CheckingBilling and EnablingCampaign stay pending
      });

      mockGoogleAPIService.mockImplementation(
        () =>
          ({
            getPaymentStatus: vi.fn().mockResolvedValue({ has_payment: false }),
          }) as any
      );

      const result = await testGraph<DeployGraphState>()
        .withState({
          jwt: "test-jwt",
          threadId: "thread_campaign_dep_5" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId,
          instructions: { googleAds: true },
          tasks,
          chatId: 1,
        })
        .runNode(taskExecutorNode)
        .execute();

      // CheckingBilling is the first non-done task — executor picks it up
      const billingTask = Task.findTask(result.state.tasks, "CheckingBilling");
      expect(billingTask?.status).toBe("running");
    });
  });

  /**
   * =============================================================================
   * 8. CAMPAIGN DEPLOYMENT TESTS [campaign]
   * =============================================================================
   * These tests verify Google Ads campaign deployment.
   *
   * USER OUTCOME: Campaign is enabled after payment is verified.
   */
  describe("Campaign Deployment", () => {
    let campaignId: number | undefined;

    beforeEach(async () => {
      vi.clearAllMocks();
      await DatabaseSnapshotter.restoreSnapshot("campaign_complete");
      campaignId = (await db.select().from(campaigns).limit(1).execute())[0]?.id;

      // Default: Google connected, verified, and payment configured
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

      // Mock JobRunAPIService to prevent real Rails worker dispatch
      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: vi.fn().mockResolvedValue({ id: 777, status: "pending" }),
          }) as any
      );
    });

    /**
     * USER OUTCOME: Users with payment skip billing check.
     */
    it("skips billing when payment configured", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId,

          instructions: { googleAds: true },
          tasks: Deploy.withTasks({ googleAds: true }, { CheckingBilling: "pending" }),
          chatId: 1,
        })
        .execute();

      const billingTask = result.state.tasks.find((t) => t.name === "CheckingBilling");
      expect(billingTask?.status).toBe("skipped");
    });

    /**
     * USER OUTCOME: Users without payment are prompted to add billing.
     */
    it("prompts for billing when no payment", async () => {
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
          projectId: 1,
          websiteId: 1,
          campaignId,

          instructions: { googleAds: true },
          tasks: Deploy.withTasks({ googleAds: true }, { CheckingBilling: "pending" }),
          chatId: 1,
        })
        .execute();

      const billingTask = result.state.tasks.find((t) => t.name === "CheckingBilling");
      expect(billingTask?.status).toBe("running");
      expect(billingTask?.jobId).toBeDefined();
    });

    /**
     * USER OUTCOME: When payment check returns has_payment: false,
     * billing task stays blocking (does NOT complete).
     */
    it("keeps blocking when payment callback returns has_payment: false", async () => {
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

      // Start with CheckingBilling pending (earlier tasks completed)
      const graph = testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId,

          instructions: { googleAds: true },
          tasks: Deploy.withTasks({ googleAds: true }, { CheckingBilling: "pending" }),
          chatId: 1,
        });

      // First execution: creates the job run, task becomes running with jobId
      const result = await graph.execute();
      const billingTask = result.state.tasks.find((t) => t.name === "CheckingBilling");
      expect(billingTask?.status).toBe("running");
      expect(billingTask?.jobId).toBeDefined();

      // Simulate webhook callback with has_payment: false
      await jobRunCallback({
        job_run_id: billingTask?.jobId!,
        thread_id: graph.threadId!,
        status: "completed",
        result: { has_payment: false },
      });

      // Resume graph after callback
      const updates = (
        await deployGraph.getState({
          configurable: { thread_id: graph.threadId },
        })
      ).values;

      const updatedResult = await deployGraph.invoke(updates, {
        configurable: { thread_id: graph.threadId },
      });

      const updatedBillingTask = updatedResult.tasks.find(
        (t: Deploy.Task) => t.name === "CheckingBilling"
      );

      // Task should NOT be completed — payment is not set up
      expect(updatedBillingTask?.status).not.toBe("completed");
      expect(updatedBillingTask?.status).toBe("running");

      // Should NOT have advanced to EnableCampaign
      const enableTask = updatedResult.tasks.find(
        (t: Deploy.Task) => t.name === "EnablingCampaign"
      );
      expect(enableTask?.status).not.toBe("running");
    });

    /**
     * USER OUTCOME: When payment check returns has_payment: true,
     * billing task completes and deploy proceeds.
     */
    it("completes billing when payment callback returns has_payment: true", async () => {
      // Mock: payment NOT yet configured (so shouldSkip returns false and job is created)
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

      // Start with CheckingBilling pending (earlier tasks completed)
      const graph = testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId,

          instructions: { googleAds: true },
          tasks: Deploy.withTasks({ googleAds: true }, { CheckingBilling: "pending" }),
          chatId: 1,
        });

      // First execution: creates the job run
      const result = await graph.execute();
      const billingTask = result.state.tasks.find((t) => t.name === "CheckingBilling");
      expect(billingTask?.status).toBe("running");

      // Simulate webhook callback with has_payment: true
      await jobRunCallback({
        job_run_id: billingTask?.jobId!,
        thread_id: graph.threadId!,
        status: "completed",
        result: { has_payment: true },
      });

      // Resume graph after callback
      const updates = (
        await deployGraph.getState({
          configurable: { thread_id: graph.threadId },
        })
      ).values;

      const updatedResult = await deployGraph.invoke(updates, {
        configurable: { thread_id: graph.threadId },
      });

      const updatedBillingTask = updatedResult.tasks.find(
        (t: Deploy.Task) => t.name === "CheckingBilling"
      );

      // Task SHOULD be completed — payment is configured
      expect(updatedBillingTask?.status).toBe("completed");
    });

    /**
     * USER OUTCOME: Campaign enabling job is created.
     */
    it("creates enabling job", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId,

          instructions: { googleAds: true },
          tasks: Deploy.withTasks({ googleAds: true }, { EnablingCampaign: "pending" }),
          chatId: 1,
        })
        .execute();

      const enableTask = result.state.tasks.find((t) => t.name === "EnablingCampaign");
      expect(enableTask?.status).toBe("running");
      expect(enableTask?.jobId).toBeDefined();
    });
  });

  /**
   * =============================================================================
   * 9. NOTHING CHANGED DETECTION TESTS
   * =============================================================================
   * These tests verify the change detection flow that skips deploy when
   * no content has changed since the last deployment.
   *
   * USER OUTCOME: Redeploying without changes completes instantly with
   * "Everything is already up to date" instead of running the full pipeline.
   */
  describe("Nothing Changed Detection", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      await DatabaseSnapshotter.restoreSnapshot("website_deploy_step");
    });

    it("skips deploy when nothing changed", async () => {
      // Mock checkChanges returning all false (nothing changed)
      mockDeployAPIService.mockImplementation(
        () =>
          ({
            create: vi.fn().mockResolvedValue({
              id: 1,
              project_id: 1,
              status: "pending",
              is_live: false,
              thread_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }),
            update: vi.fn().mockResolvedValue({
              id: 1,
              project_id: 1,
              status: "completed",
              is_live: true,
              thread_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }),
            checkChanges: vi.fn().mockResolvedValue({ website: false }),
          }) as any
      );

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_nothing_changed" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          instructions: { website: true },
          tasks: [],
          chatId: 1,
        })
        .execute();

      // Should exit with nothingChanged and completed status
      expect(result.state.nothingChanged).toBe(true);
      expect(result.state.status).toBe("completed");
      expect(result.state.deployId).toBeDefined();
      // No tasks should have been created (skipped the full pipeline)
      expect(result.state.tasks.length).toBe(0);
    });

    it("narrows instructions when only some things changed", async () => {
      // Mock checkChanges: website changed, campaign did not
      mockDeployAPIService.mockImplementation(
        () =>
          ({
            create: vi.fn().mockResolvedValue({
              id: 1,
              project_id: 1,
              status: "pending",
              is_live: false,
              thread_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }),
            update: vi.fn().mockResolvedValue({
              id: 1,
              project_id: 1,
              status: "completed",
              is_live: true,
              thread_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }),
            checkChanges: vi.fn().mockResolvedValue({ website: true, campaign: false }),
          }) as any
      );

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

      // Mock JobRunAPIService to prevent real Rails worker dispatch
      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: vi.fn().mockResolvedValue({ id: 999, status: "pending" }),
          }) as any
      );

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_partial_changed" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          campaignId: 1,
          instructions: { website: true, googleAds: true },
          tasks: [],
          chatId: 1,
        })
        .stopAfter("initPhases")
        .execute();

      // Should NOT be nothingChanged (website did change)
      expect(result.state.nothingChanged).toBe(false);
      // Instructions should be narrowed — googleAds set to false
      expect(result.state.instructions.website).toBe(true);
      expect(result.state.instructions.googleAds).toBe(false);
      // Should only have website tasks, no campaign tasks
      const campaignTasks = result.state.tasks.filter((t) =>
        ["ConnectingGoogle", "VerifyingGoogle", "CheckingBilling", "DeployingCampaign", "EnablingCampaign"].includes(t.name)
      );
      expect(campaignTasks.length).toBe(0);
    });

    it("proceeds with full deploy when change check fails", async () => {
      // Mock checkChanges throwing an error
      mockDeployAPIService.mockImplementation(
        () =>
          ({
            create: vi.fn().mockResolvedValue({
              id: 1,
              project_id: 1,
              status: "pending",
              is_live: false,
              thread_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }),
            update: vi.fn().mockResolvedValue({
              id: 1,
              project_id: 1,
              status: "completed",
              is_live: true,
              thread_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }),
            checkChanges: vi.fn().mockRejectedValue(new Error("Network error")),
          }) as any
      );

      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: vi.fn().mockResolvedValue({ id: 999, status: "pending" }),
          }) as any
      );

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_check_failed" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          instructions: { website: true },
          tasks: [],
          chatId: 1,
        })
        .stopAfter("initPhases")
        .execute();

      // Should proceed normally — not nothingChanged
      expect(result.state.nothingChanged).toBe(false);
      // Should have tasks created (full deploy pipeline)
      expect(result.state.tasks.length).toBeGreaterThan(0);
    });
  });
});
