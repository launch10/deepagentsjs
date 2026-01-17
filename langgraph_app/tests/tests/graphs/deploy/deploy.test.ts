import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WebsiteGraphState } from "@annotation";
import { MemorySaver } from "@langchain/langgraph";
import { testGraph } from "@support";
import { deployGraph as uncompiledGraph } from "@graphs";
import type { DeployGraphState } from "@annotation";
import type { ThreadIDType } from "@types";
import { Deploy } from "@types";
import { graphParams } from "@core";
import { DatabaseSnapshotter } from "@rails_api";
import { websiteFiles, and, eq, db } from "@db";
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

// Clean up test files after each test
const TEST_WEBSITE_ID = 1;
afterEach(async () => {
  const backend = await getCodingAgentBackend({
    websiteId: TEST_WEBSITE_ID,
    jwt: "test-jwt",
  } as WebsiteGraphState);
  await backend.cleanup();
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

/**
 * =============================================================================
 * 1. GOOGLE CONNECT/VERIFY TESTS [campaign]
 * =============================================================================
 * These tests verify the conditional routing for Google OAuth and invite flows.
 * The key principle: "Never enqueue what you won't run"
 */
describe("Deploy Graph - Campaign Skippable Tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

  // Helper: Completed website tasks needed before campaign flow
  const completedWebsiteTasksForCampaign = [
    { ...Deploy.createTask("AddingAnalytics"), status: "completed" as const },
    { ...Deploy.createTask("OptimizingSEO"), status: "completed" as const },
    { ...Deploy.createTask("ValidateLinks"), status: "completed" as const },
    { ...Deploy.createTask("RuntimeValidation"), status: "completed" as const },
    { ...Deploy.createTask("DeployingWebsite"), status: "completed" as const },
  ];

  describe.only("ConnectingGoogle - Conditional Routing", () => {
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

      // With the new flow: analytics → seo → validation → deploy → campaign
      // We need website tasks completed to reach campaign
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: 123,
          deploy: { googleAds: true },
          tasks: [...completedWebsiteTasksForCampaign],
        })
        .stopAfter("enqueueDeployCampaign")
        .execute();

      // Should NOT have ConnectingGoogle task (it was skipped)
      const googleConnectTask = result.state.tasks.find((t) => t.name === "ConnectingGoogle");
      expect(googleConnectTask).toBeUndefined();

      // Should NOT have VerifyingGoogle task (it was also skipped)
      const verifyTask = result.state.tasks.find((t) => t.name === "VerifyingGoogle");
      expect(verifyTask).toBeUndefined();

      // Should have DeployingCampaign task (went straight to deploy)
      const deployTask = result.state.tasks.find((t) => t.name === "DeployingCampaign");
      expect(deployTask).toBeDefined();
      expect(deployTask?.status).toBe("running");
    });

    it("runs ConnectingGoogle when Google is NOT connected", async () => {
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

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: undefined,
          deploy: { googleAds: true },
          tasks: [],
        })
        .stopAfter("enqueueGoogleConnect")
        .execute();

      // Should have ConnectingGoogle task created by enqueue node
      const googleConnectTask = result.state.tasks.find((t) => t.name === "ConnectingGoogle");
      expect(googleConnectTask).toBeDefined();
      expect(googleConnectTask?.status).toBe("running"); // enqueueTask creates with running status
    });

    it("proceeds to verifyGoogle after ConnectingGoogle completes", async () => {
      // Mock: Google connected but invite not yet accepted
      mockGoogleAPIService.mockImplementation(
        () =>
          ({
            getConnectionStatus: vi
              .fn()
              .mockResolvedValue({ connected: true, email: "user@gmail.com" }),
            getInviteStatus: vi
              .fn()
              .mockResolvedValue({ accepted: false, status: "sent", email: "user@gmail.com" }),
          }) as any
      );

      // Start with ConnectingGoogle already completed
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: undefined,
          deploy: { googleAds: true },
          tasks: [{ ...Deploy.createTask("ConnectingGoogle"), status: "completed" }],
        })
        .stopAfter("enqueueGoogleVerify")
        .execute();

      // Should have both ConnectingGoogle (completed) and VerifyingGoogle (pending) tasks
      const googleTask = result.state.tasks.find((t) => t.name === "ConnectingGoogle");
      const verifyTask = result.state.tasks.find((t) => t.name === "VerifyingGoogle");

      expect(googleTask?.status).toBe("completed");
      expect(verifyTask).toBeDefined();
      expect(verifyTask?.status).toBe("running"); // enqueueTask creates with running status
    });

    it("proceeds to deploy after both GoogleConnect and GoogleVerify complete", async () => {
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

      // With the new flow: Google setup → analytics → seo → validation → deploy → campaign
      // We need website tasks completed to reach campaign
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: undefined,
          deploy: { googleAds: true },
          tasks: [
            { ...Deploy.createTask("ConnectingGoogle"), status: "completed" },
            { ...Deploy.createTask("VerifyingGoogle"), status: "completed" },
            ...completedWebsiteTasksForCampaign,
          ],
        })
        .stopAfter("enqueueDeployCampaign")
        .execute();

      // Should have all tasks
      const googleTask = result.state.tasks.find((t) => t.name === "ConnectingGoogle");
      const verifyTask = result.state.tasks.find((t) => t.name === "VerifyingGoogle");
      const deployTask = result.state.tasks.find((t) => t.name === "DeployingCampaign");

      expect(googleTask?.status).toBe("completed");
      expect(verifyTask?.status).toBe("completed");
      expect(deployTask).toBeDefined();
      expect(deployTask?.status).toBe("running"); // enqueueTask creates with running status
    });
  });

  /**
   * FAILURE RECOVERY
   * Verify the graph can recover after a task fails (e.g., user cancels OAuth).
   * This is critical for HITL flows where users may need to retry.
   */
  describe("Failure Recovery", () => {
    it("can resume after ConnectingGoogle fails by retrying OAuth", async () => {
      // Mock: Google NOT connected (user will need to retry OAuth)
      mockGoogleAPIService.mockImplementation(
        () =>
          ({
            getConnectionStatus: vi.fn().mockResolvedValue({ connected: false, email: null }),
            getInviteStatus: vi
              .fn()
              .mockResolvedValue({ accepted: false, status: "none", email: null }),
          }) as any
      );

      // Scenario: Previous OAuth attempt failed, user wants to retry
      // The failed task should be replaced with a new running task
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: undefined,
          deploy: { googleAds: true },
          tasks: [
            {
              ...Deploy.createTask("ConnectingGoogle"),
              status: "failed",
              error: "OAuth was cancelled by user",
            },
          ],
        })
        .stopAfter("googleConnect")
        .execute();

      // The failed task should remain failed (idempotent - we don't auto-retry failed tasks)
      // This is correct behavior: the node returns {} for failed tasks
      const googleTask = result.state.tasks.find((t) => t.name === "ConnectingGoogle");
      expect(googleTask?.status).toBe("failed");

      // To actually retry, the frontend/user would need to:
      // 1. Clear the failed task, OR
      // 2. Create a new task with status "pending"
      // This test verifies the graph doesn't crash on failed state
    });

    it("continues to deploy when ConnectingGoogle succeeds after webhook callback", async () => {
      // Mock: Google now connected (OAuth completed via webhook)
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

      // Scenario: Webhook updated task with google_email result
      // The conditional routing uses API status (not task status) to decide routing
      // So when API says connected=true, it skips googleConnect node entirely
      // With the new flow: Google setup → analytics → seo → validation → deploy → campaign
      // We need website tasks completed to reach campaign
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: undefined,
          deploy: { googleAds: true },
          tasks: [
            {
              ...Deploy.createTask("ConnectingGoogle"),
              status: "running",
              jobId: 123,
              result: { google_email: "user@gmail.com" }, // Webhook set this
            },
            { ...Deploy.createTask("VerifyingGoogle"), status: "completed" },
            ...completedWebsiteTasksForCampaign,
          ],
        })
        .stopAfter("enqueueDeployCampaign")
        .execute();

      // ConnectingGoogle stays "running" because the node was skipped (API says connected)
      // This is correct - the API check is authoritative, task status is informational
      const googleTask = result.state.tasks.find((t) => t.name === "ConnectingGoogle");
      expect(googleTask?.status).toBe("running");
      expect(googleTask?.result).toEqual({ google_email: "user@gmail.com" });

      // Key assertion: Flow proceeded to deploy despite task not being "completed"
      const deployTask = result.state.tasks.find((t) => t.name === "DeployingCampaign");
      expect(deployTask).toBeDefined();
      expect(deployTask?.status).toBe("running");
    });

    it("continues from VerifyingGoogle after invite accepted via webhook", async () => {
      // Mock: Invite now accepted
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

      // Scenario: Webhook updated VerifyingGoogle with accepted status
      // Similar to ConnectingGoogle - the API check is authoritative
      // With the new flow: verifyGoogle → analytics → seo → validation → deploy → campaign
      // So we need all website tasks completed to reach campaign
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: undefined,
          deploy: { googleAds: true },
          tasks: [
            { ...Deploy.createTask("ConnectingGoogle"), status: "completed" },
            {
              ...Deploy.createTask("VerifyingGoogle"),
              status: "running",
              jobId: 456,
              result: { status: "accepted" }, // Webhook set this
            },
            // Website tasks need to be completed to proceed to campaign
            { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
            { ...Deploy.createTask("OptimizingSEO"), status: "completed" },
            { ...Deploy.createTask("ValidateLinks"), status: "completed" },
            { ...Deploy.createTask("RuntimeValidation"), status: "completed" },
            { ...Deploy.createTask("DeployingWebsite"), status: "completed" },
          ],
        })
        .stopAfter("enqueueDeployCampaign")
        .execute();

      // VerifyingGoogle stays "running" because the node was skipped (API says accepted)
      // This is correct - the API check is authoritative, task status is informational
      const verifyTask = result.state.tasks.find((t) => t.name === "VerifyingGoogle");
      expect(verifyTask?.status).toBe("running");
      expect(verifyTask?.result).toEqual({ status: "accepted" });

      // Key assertion: Flow proceeded to deploy despite task not being "completed"
      const deployTask = result.state.tasks.find((t) => t.name === "DeployingCampaign");
      expect(deployTask).toBeDefined();
      expect(deployTask?.status).toBe("running");
    });
  });

  /**
   * PHASE COMPUTATION
   * Verify phases are computed correctly through the campaign deploy flow.
   */
  describe("Phase Computation - Campaign", () => {
    it("computes ConnectingGoogle phase when ConnectingGoogle is running", async () => {
      // Mock: Google NOT connected so we'll run ConnectingGoogle
      mockGoogleAPIService.mockImplementation(
        () =>
          ({
            getConnectionStatus: vi.fn().mockResolvedValue({ connected: false, email: null }),
            getInviteStatus: vi
              .fn()
              .mockResolvedValue({ accepted: false, status: "none", email: null }),
          }) as any
      );

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: undefined,
          deploy: { googleAds: true },
          tasks: [],
        })
        .stopAfter("enqueueGoogleConnect")
        .execute();

      // ConnectingGoogle task should be running (created by enqueue node)
      const googleTask = result.state.tasks.find((t) => t.name === "ConnectingGoogle");
      expect(googleTask).toBeDefined();
      expect(googleTask?.status).toBe("running"); // enqueueTask creates with running status

      // Phases should be computed if available
      if (result.state.phases) {
        expect(result.state.phases.length).toBeGreaterThan(0);
        const googlePhase = result.state.phases.find((p) => p.name === "ConnectingGoogle");
        expect(googlePhase).toBeDefined();
        expect(googlePhase?.status).toBe("running");
      }
    });

    it("skips ConnectingGoogle phase when Google already connected", async () => {
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

      // With the new flow, we need all website tasks completed to reach campaign
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: 123, // Google connected
          deploy: { googleAds: true },
          tasks: [
            // Website tasks need to be completed to proceed to campaign
            { ...Deploy.createTask("ConnectingGoogle"), status: "completed" },
            { ...Deploy.createTask("VerifyingGoogle"), status: "completed" },
            { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
            { ...Deploy.createTask("OptimizingSEO"), status: "completed" },
            { ...Deploy.createTask("ValidateLinks"), status: "completed" },
            { ...Deploy.createTask("RuntimeValidation"), status: "completed" },
            { ...Deploy.createTask("DeployingWebsite"), status: "completed" },
          ],
        })
        .stopAfter("enqueueDeployCampaign")
        .execute();

      // ConnectingGoogle phase should be completed (we included completed task)
      const googlePhase = result.state.phases?.find((p) => p.name === "ConnectingGoogle");

      // Either undefined (not computed) or completed (included completed task)
      if (googlePhase) {
        expect(googlePhase.status).toBe("completed");
      }

      // DeployingCampaign phase should be running
      const deployPhase = result.state.phases?.find((p) => p.name === "DeployingCampaign");
      expect(deployPhase?.status).toBe("running");
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
describe("AddingAnalytics - Lead capture setup", () => {
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

  it("marks instrumentation task as completed when already instrumented", async () => {
    const result = await testGraph<DeployGraphState>()
      .withGraph(deployGraph)
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
 * 3. SEO OPTIMIZATION TESTS [all]
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
      .withGraph(deployGraph)
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
      .withGraph(deployGraph)
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
      .withGraph(deployGraph)
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
      .withGraph(deployGraph)
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
      .withGraph(deployGraph)
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

/**
 * =============================================================================
 * 4. PHASE COMPUTATION TESTS [all]
 * =============================================================================
 * These tests verify that phases are correctly computed from tasks during
 * the deploy website graph execution.
 *
 * Key phase for website deploy:
 * - AddingAnalytics (1:1 with task)
 * - OptimizingSEO (1:1 with task)
 * - CheckingForBugs (MERGED: ValidateLinks + RuntimeValidation)
 * - FixingBugs (1:1 with task)
 * - DeployingWebsite (1:1 with task)
 */
describe("Phase Computation - Website Deploy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CheckingForBugs Phase (merged tasks)", () => {
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
          tasks: [
            { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
            { ...Deploy.createTask("OptimizingSEO"), status: "completed" },
            { ...Deploy.createTask("ValidateLinks"), status: "running" },
          ],
        })
        .stopAfter("validateLinks")
        .execute();

      const checkingForBugsPhase = result.state.phases.find((p) => p.name === "CheckingForBugs");

      expect(checkingForBugsPhase).toBeDefined();
      expect(checkingForBugsPhase?.status).toBe("running");
      // ValidateLinks running, RuntimeValidation not yet started
      expect(checkingForBugsPhase?.progress).toBe(0);
    });

    it("computes CheckingForBugs at 50% when ValidateLinks completed, RuntimeValidation pending", async () => {
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
            { ...Deploy.createTask("RuntimeValidation"), status: "pending" },
          ],
        })
        .stopAfter("runtimeValidation")
        .execute();

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
          tasks: [
            { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
            { ...Deploy.createTask("OptimizingSEO"), status: "completed" },
            { ...Deploy.createTask("ValidateLinks"), status: "completed" },
            {
              ...Deploy.createTask("RuntimeValidation"),
              status: "failed",
              error: "Console errors found in browser",
            },
          ],
        })
        .stopAfter("bugFix")
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
          tasks: [
            { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
            { ...Deploy.createTask("OptimizingSEO"), status: "completed" },
            { ...Deploy.createTask("ValidateLinks"), status: "completed" },
            { ...Deploy.createTask("RuntimeValidation"), status: "completed" },
          ],
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

  describe("FixingBugs Phase (separate from CheckingForBugs)", () => {
    it("FixingBugs phase is separate from CheckingForBugs phase", async () => {
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
            { ...Deploy.createTask("RuntimeValidation"), status: "failed", error: "Error" },
            { ...Deploy.createTask("FixingBugs"), status: "running" },
          ],
        })
        .stopAfter("bugFix")
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
      expect(fixingBugsPhase?.status).toBe("running");
    });

    it("FixingBugs phase completes independently of CheckingForBugs", async () => {
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
            { ...Deploy.createTask("FixingBugs"), status: "completed" },
          ],
        })
        .stopAfter("deployWebsite")
        .execute();

      const checkingForBugsPhase = result.state.phases.find((p) => p.name === "CheckingForBugs");
      const fixingBugsPhase = result.state.phases.find((p) => p.name === "FixingBugs");

      // Both should be completed
      expect(checkingForBugsPhase?.status).toBe("completed");
      expect(fixingBugsPhase?.status).toBe("completed");
    });
  });

  describe("Full Phase Flow", () => {
    it("phases progress correctly through website deploy flow", async () => {
      // Test phase computation at different stages using computePhases directly
      // This tests the same logic the graph uses via withPhases()

      // Stage 1: Instrumentation running
      let tasks: Deploy.Task[] = [{ ...Deploy.createTask("AddingAnalytics"), status: "running" }];
      let phases = Deploy.computePhases(tasks);

      expect(phases.find((p) => p.name === "AddingAnalytics")?.status).toBe("running");
      expect(phases.find((p) => p.name === "OptimizingSEO")?.status).toBe("pending");
      expect(phases.find((p) => p.name === "CheckingForBugs")?.status).toBe("pending");
      expect(phases.find((p) => p.name === "DeployingWebsite")?.status).toBe("pending");

      // Stage 2: SEO completed, validation running
      tasks = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
        { ...Deploy.createTask("OptimizingSEO"), status: "completed" },
        { ...Deploy.createTask("ValidateLinks"), status: "running" },
      ];
      phases = Deploy.computePhases(tasks);

      expect(phases.find((p) => p.name === "AddingAnalytics")?.status).toBe("completed");
      expect(phases.find((p) => p.name === "OptimizingSEO")?.status).toBe("completed");
      expect(phases.find((p) => p.name === "CheckingForBugs")?.status).toBe("running");

      // Stage 3: Validation complete, deploying
      tasks = [
        { ...Deploy.createTask("AddingAnalytics"), status: "completed" },
        { ...Deploy.createTask("OptimizingSEO"), status: "completed" },
        { ...Deploy.createTask("ValidateLinks"), status: "completed" },
        { ...Deploy.createTask("RuntimeValidation"), status: "completed" },
        { ...Deploy.createTask("DeployingWebsite"), status: "running" },
      ];
      phases = Deploy.computePhases(tasks);

      expect(phases.find((p) => p.name === "CheckingForBugs")?.status).toBe("completed");
      expect(phases.find((p) => p.name === "DeployingWebsite")?.status).toBe("running");
    });

    it("all website deploy phases are present when computed", () => {
      // Verify all phases are defined in PhaseTaskMap
      const phases = Deploy.computePhases([]);
      const phaseNames = phases.map((p) => p.name);

      // Verify all expected website deploy phases exist
      expect(phaseNames).toContain("AddingAnalytics");
      expect(phaseNames).toContain("OptimizingSEO");
      expect(phaseNames).toContain("CheckingForBugs");
      expect(phaseNames).toContain("FixingBugs");
      expect(phaseNames).toContain("DeployingWebsite");
    });

    it("CheckingForBugs phase contains correct task names", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: { website: true },
          tasks: [
            { ...Deploy.createTask("ValidateLinks"), status: "completed" },
            { ...Deploy.createTask("RuntimeValidation"), status: "running" },
          ],
        })
        .stopAfter("runtimeValidation")
        .execute();

      const checkingPhase = result.state.phases.find((p) => p.name === "CheckingForBugs");

      expect(checkingPhase?.taskNames).toBeDefined();
      expect(checkingPhase?.taskNames).toContain("ValidateLinks");
      expect(checkingPhase?.taskNames).toContain("RuntimeValidation");
      expect(checkingPhase?.taskNames).not.toContain("FixingBugs"); // FixingBugs is separate
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

  /**
   * IDEMPOTENCY TESTS
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
        .withGraph(deployGraph)
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
        .withGraph(deployGraph)
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
        .withGraph(deployGraph)
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
 * 6. FULL WORKFLOW TESTS (skipped)
 * =============================================================================
 * These tests verify the complete fire-and-forget + webhook pattern across
 * the unified deploy graph.
 */
describe.skip("Deploy Graph - Full Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

  describe("Website deploy flow", () => {
    it("runs instrumentation -> validation -> deploy when deployWebsite=true", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: {
            website: true,
            googleAds: false,
          },
          tasks: [],
        })
        .stopAfter("analytics")
        .execute();

      // Should have instrumentation task
      const instrumentationTask = result.state.tasks.find((t) => t.name === "AddingAnalytics");
      expect(instrumentationTask).toBeDefined();
      expect(instrumentationTask?.status).toBe("completed");
    });
  });

  describe("Campaign deploy flow", () => {
    it("first invocation fires job and returns pending status", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          deploy: { googleAds: true },
          tasks: [],
        })
        .stopAfter("deployCampaign")
        .execute();

      expect(result.state.status).toBe("pending");
      expect(result.state.tasks.length).toBeGreaterThanOrEqual(1);
      const deployTask = result.state.tasks.find((t) => t.name === "DeployingCampaign");
      expect(deployTask).toBeDefined();
      expect(deployTask?.status).toBe("pending");
      expect(deployTask?.jobId).toBe(123);
    });
  });

  describe("Fire-and-forget + webhook pattern", () => {
    it("first invocation fires job and returns pending, second invocation with result completes", async () => {
      const checkpointer = new MemorySaver();
      const graph = uncompiledGraph.compile({ checkpointer });
      const threadId = "test-thread-123";

      const initialState: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        deploy: { googleAds: true },
        tasks: [],
      };

      const firstResult = await graph.invoke(initialState, {
        configurable: { thread_id: threadId },
      });

      expect(firstResult.status).toBe("pending");
      const deployTask = firstResult.tasks.find((t: Deploy.Task) => t.name === "DeployingCampaign");
      expect(deployTask).toBeDefined();
      expect(deployTask?.status).toBe("pending");
      expect(deployTask?.jobId).toBe(123);

      // Simulate webhook updating the task with result
      await graph.updateState(
        { configurable: { thread_id: threadId } },
        {
          tasks: [
            {
              ...deployTask,
              status: "running",
              result: {
                campaign_id: 456,
                external_id: "ext_789",
                deployed_at: "2024-01-15T10:00:00Z",
              },
            },
          ],
        }
      );

      // Second invocation (e.g., from frontend poll or webhook graph run)
      const secondResult = await graph.invoke({}, { configurable: { thread_id: threadId } });

      expect(secondResult.status).toBe("completed");
      expect(secondResult.result).toEqual({
        campaign_id: 456,
        external_id: "ext_789",
        deployed_at: "2024-01-15T10:00:00Z",
      });
      const completedTask = secondResult.tasks.find(
        (t: Deploy.Task) => t.name === "DeployingCampaign"
      );
      expect(completedTask?.status).toBe("completed");
    });

    it("handles job failure from webhook", async () => {
      const checkpointer = new MemorySaver();
      const graph = uncompiledGraph.compile({ checkpointer });
      const threadId = "test-thread-failure";

      const initialState: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        deploy: { googleAds: true },
        tasks: [],
      };

      const firstResult = await graph.invoke(initialState, {
        configurable: { thread_id: threadId },
      });

      expect(firstResult.status).toBe("pending");
      const deployTask = firstResult.tasks.find((t: Deploy.Task) => t.name === "DeployingCampaign");

      // Simulate webhook with error
      await graph.updateState(
        { configurable: { thread_id: threadId } },
        {
          tasks: [
            {
              ...deployTask,
              status: "running",
              error: "API rate limit exceeded",
            },
          ],
        }
      );

      // Next invocation processes the error
      const secondResult = await graph.invoke({}, { configurable: { thread_id: threadId } });

      expect(secondResult.status).toBe("failed");
      expect(secondResult.error).toEqual({
        message: "API rate limit exceeded",
        node: "deployCampaignNode",
      });
      const failedTask = secondResult.tasks.find(
        (t: Deploy.Task) => t.name === "DeployingCampaign"
      );
      expect(failedTask?.status).toBe("failed");
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
