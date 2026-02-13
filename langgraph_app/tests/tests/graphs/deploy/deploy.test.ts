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
  };
});

vi.mock("@services", async () => {
  const actual = await vi.importActual("@services");
  // Re-use the same JobRunAPIService mock from @rails_api so both import paths share one mock
  const { JobRunAPIService } = await import("@rails_api");
  return {
    ...actual,
    GoogleAPIService: vi.fn(),
    JobRunAPIService,
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
            deployId: 1,
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
              projectId,
              websiteId: 1,
              campaignId: 123,
              deployId: 1,
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
              projectId,
              websiteId: 1,
              campaignId: 123,
              deployId: 1,
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
              projectId,
              websiteId: 1,
              campaignId,
              deployId: 1,
              deploy: { googleAds: true },
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

          // Should have ConnectingGoogle task with running status
          expect(updatedGoogleConnectTask).toBeDefined();
          expect(updatedGoogleConnectTask?.status).toBe("completed");
          expect(updatedResult.tasks.length).toBe(2); // this is a blocking action, it will not have run other tasks...
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
              deployId: 1,
              deploy: { googleAds: true },
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
              deployId: 1,
              deploy: { googleAds: true, website: true },
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
      // Use a snapshot that doesn't have analytics
      await DatabaseSnapshotter.restoreSnapshot("website_step_finished");
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
      const updatedContent = existingIndexHtml?.content?.replace("<head>", `<head>${seoTags}`);

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
          projectId: 1,
          websiteId: 1,
          deployId: 1,
          deploy: { website: true },
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
      // Use website_step_finished snapshot which has a complete website
      await DatabaseSnapshotter.restoreSnapshot("website_step_finished");

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          deployId: 1,
          deploy: { website: true },
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
      await DatabaseSnapshotter.restoreSnapshot("website_step_finished");

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          deployId: 1,
          deploy: { website: true },
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
      await DatabaseSnapshotter.restoreSnapshot("website_step_finished");

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          deployId: 1,
          deploy: { website: true },
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
  describe("Link Validation", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      await DatabaseSnapshotter.restoreSnapshot("website_step_finished");
    });

    /**
     * USER OUTCOME: Broken links are caught before going live.
     * The snapshot includes Footer.tsx with placeholder href="#" links.
     */
    it("detects broken anchor links", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          deployId: 1,
          deploy: { website: true },
          tasks: Deploy.withTasks({ website: true }, { ValidateLinks: "pending" }),
          chatId: 1,
        })
        .stopAfter("validateLinks")
        .execute();

      const validateTask = result.state.tasks.find((t) => t.name === "ValidateLinks");
      expect(validateTask?.status).toBe("failed");
      expect(validateTask?.error).toContain("Broken anchor");
    });
  });

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
      await DatabaseSnapshotter.restoreSnapshot("website_step_finished");
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
          deployId: 1,
          deploy: { website: true },
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

    /**
     * USER OUTCOME: Broken links are fixed after bug fix runs.
     */
    it("fixes broken links", async () => {
      // Use the website_with_broken_links snapshot which has broken anchor links
      await DatabaseSnapshotter.restoreSnapshot("website_with_broken_links");

      // Verify broken links exist before (Nav.tsx has #TestimonialsBorked and #CTABorked)
      const navBefore = await db
        .select()
        .from(websiteFiles)
        .where(
          and(eq(websiteFiles.websiteId, 1), eq(websiteFiles.path, "src/components/Header.tsx"))
        )
        .execute()
        .then((files) => files.at(-1));

      expect(navBefore?.content).toContain("#testimonials-borked");

      // Run bug fix (validation already failed with broken anchor errors)
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          projectId: 1,
          websiteId: 1,
          deployId: 1,
          deploy: { website: true },
          tasks: Deploy.withTasks(
            { website: true },
            {
              ValidateLinks: {
                status: "failed",
                error: "Broken anchor: #testimonials-borked - no element with id",
              },
              FixingBugs: "pending",
            },
            { after: "completed" }
          ),
          chatId: 1,
        })
        .execute();

      // Verify bug fix completed
      const fixingBugsTask = result.state.tasks.find((t) => t.name === "FixingBugs");
      expect(fixingBugsTask?.status).toBe("completed");

      // Verify broken links are fixed - the borked anchors should be replaced with valid ones
      const navAfter = await db
        .select()
        .from(websiteFiles)
        .where(
          and(eq(websiteFiles.websiteId, 1), eq(websiteFiles.path, "src/components/Header.tsx"))
        )
        .execute()
        .then((files) => files.at(-1));

      // The broken anchors should no longer exist
      expect(navAfter?.content).not.toContain("#testimonials-borked");
    });
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
      await DatabaseSnapshotter.restoreSnapshot("website_step_finished");

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
          deployId: 1,
          deploy: { googleAds: true },
          tasks: [],
          chatId: 1,
        })
        .execute();

      const deployTask = result.state.tasks.find((t) => t.name === "DeployingWebsite");
      expect(deployTask).toBeUndefined();
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
          deployId: 1,
          deploy: { website: true },
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
   * 7. CAMPAIGN DEPLOYMENT TESTS [campaign]
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
          deployId: 1,
          deploy: { googleAds: true },
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
          deployId: 1,
          deploy: { googleAds: true },
          tasks: Deploy.withTasks({ googleAds: true }, { CheckingBilling: "pending" }),
          chatId: 1,
        })
        .execute();

      const billingTask = result.state.tasks.find((t) => t.name === "CheckingBilling");
      expect(billingTask?.status).toBe("running");
      expect(billingTask?.jobId).toBeDefined();
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
          deployId: 1,
          deploy: { googleAds: true },
          tasks: Deploy.withTasks({ googleAds: true }, { EnablingCampaign: "pending" }),
          chatId: 1,
        })
        .execute();

      const enableTask = result.state.tasks.find((t) => t.name === "EnablingCampaign");
      expect(enableTask?.status).toBe("running");
      expect(enableTask?.jobId).toBeDefined();
    });
  });
});
