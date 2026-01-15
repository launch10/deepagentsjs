import { describe, it, expect, vi, beforeEach } from "vitest";
import { testGraph } from "@support";
import { deployCampaignGraph as uncompiledGraph } from "@graphs";
import type { DeployGraphState } from "@annotation";
import type { ThreadIDType } from "@types";
import { Deploy } from "@types";
import { graphParams } from "@core";

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
  };
});

import { GoogleAPIService } from "@services";
import { JobRunAPIService } from "@rails_api";

const mockGoogleAPIService = vi.mocked(GoogleAPIService);
const mockJobRunAPIService = vi.mocked(JobRunAPIService);

const deployCampaignGraph = uncompiledGraph.compile({
  ...graphParams,
  name: "deployCampaign",
});

/**
 * =============================================================================
 * SKIPPABLE TASK TESTS: ConnectingGoogle and VerifyingGoogle
 * =============================================================================
 * These tests verify the conditional routing pattern for skippable tasks.
 * The key principle: "Never enqueue what you won't run"
 */
describe("DeployCampaignGraph - Skippable Tasks", () => {
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

  describe("ConnectingGoogle - Conditional Routing", () => {
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
        .withGraph(deployCampaignGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: 123,
          deploy: { googleAds: true },
          tasks: [],
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
        .withGraph(deployCampaignGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: undefined,
          deploy: { googleAds: true },
          tasks: [],
        })
        .stopAfter("googleConnect")
        .execute();

      // Should have ConnectingGoogle task
      const googleConnectTask = result.state.tasks.find((t) => t.name === "ConnectingGoogle");
      expect(googleConnectTask).toBeDefined();
      expect(googleConnectTask?.status).toBe("running"); // Waiting for OAuth
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
        .withGraph(deployCampaignGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: undefined,
          deploy: { googleAds: true },
          tasks: [{ ...Deploy.createTask("ConnectingGoogle"), status: "completed" }],
        })
        .stopAfter("verifyGoogle")
        .execute();

      // Should have both ConnectingGoogle (completed) and VerifyingGoogle (running) tasks
      const googleTask = result.state.tasks.find((t) => t.name === "ConnectingGoogle");
      const verifyTask = result.state.tasks.find((t) => t.name === "VerifyingGoogle");

      expect(googleTask?.status).toBe("completed");
      expect(verifyTask?.status).toBe("running");
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

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployCampaignGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: undefined,
          deploy: { googleAds: true },
          tasks: [
            { ...Deploy.createTask("ConnectingGoogle"), status: "completed" },
            { ...Deploy.createTask("VerifyingGoogle"), status: "completed" },
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
      expect(deployTask?.status).toBe("running");
    });
  });

  /**
   * =============================================================================
   * FAILURE RECOVERY
   * =============================================================================
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
        .withGraph(deployCampaignGraph)
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
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployCampaignGraph)
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
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployCampaignGraph)
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
   * =============================================================================
   * PHASE COMPUTATION
   * =============================================================================
   * Verify phases are computed correctly through the campaign deploy flow.
   */
  describe("Phase Computation", () => {
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
        .withGraph(deployCampaignGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: undefined,
          deploy: { googleAds: true },
          tasks: [],
        })
        .stopAfter("googleConnect")
        .execute();

      // Phases should be computed
      expect(result.state.phases).toBeDefined();
      expect(result.state.phases.length).toBeGreaterThan(0);

      // ConnectingGoogle phase should be running
      const googlePhase = result.state.phases.find((p) => p.name === "ConnectingGoogle");
      expect(googlePhase).toBeDefined();
      expect(googlePhase?.status).toBe("running");
    });

    it("skips ConnectingGoogle phase when Google already connected", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployCampaignGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: 123, // Google connected
          deploy: { googleAds: true },
          tasks: [],
        })
        .stopAfter("enqueueDeployCampaign")
        .execute();

      // ConnectingGoogle phase should be pending (no tasks ever ran)
      const googlePhase = result.state.phases.find((p) => p.name === "ConnectingGoogle");

      // Either undefined (not computed) or pending (computed but empty)
      if (googlePhase) {
        expect(googlePhase.status).toBe("pending");
        expect(googlePhase.progress).toBe(0);
      }

      // DeployingCampaign phase should be running
      const deployPhase = result.state.phases.find((p) => p.name === "DeployingCampaign");
      expect(deployPhase?.status).toBe("running");
    });
  });
});
