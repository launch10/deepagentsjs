import { describe, it, expect, vi, beforeEach } from "vitest";
import { testGraph } from "@support";
import { deployCampaignGraph as uncompiledGraph } from "@graphs";
import type { DeployGraphState } from "@annotation";
import type { ThreadIDType } from "@types";
import { Deploy } from "@types";
import { graphParams } from "@core";

const deployCampaignGraph = uncompiledGraph.compile({
  ...graphParams,
  name: "deployCampaign",
});

/**
 * =============================================================================
 * SKIPPABLE TASK TESTS: ConnectingGoogle
 * =============================================================================
 * These tests verify the conditional routing pattern for skippable tasks.
 * The key principle: "Never enqueue what you won't run"
 */
describe("DeployCampaignGraph - Skippable Tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ConnectingGoogle - Conditional Routing", () => {
    it("skips ConnectingGoogle when Google is already connected (has campaignId)", async () => {
      // When campaignId exists, we assume Google is connected
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployCampaignGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: 123, // Has campaign = Google connected
          deploy: { googleAds: true },
          tasks: [],
        })
        .stopAfter("enqueueDeployCampaign")
        .execute();

      // Should NOT have ConnectingGoogle task (it was skipped)
      const googleConnectTask = result.state.tasks.find((t) => t.name === "ConnectingGoogle");
      expect(googleConnectTask).toBeUndefined();

      // Should have LaunchingCampaign task (went straight to deploy)
      const deployTask = result.state.tasks.find((t) => t.name === "LaunchingCampaign");
      expect(deployTask).toBeDefined();
      expect(deployTask?.status).toBe("running");
    });

    it("runs ConnectingGoogle when Google is NOT connected (no campaignId)", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployCampaignGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: undefined, // No campaign = needs Google connect
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

    it("proceeds to deploy after ConnectingGoogle completes", async () => {
      // Start with ConnectingGoogle already completed
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployCampaignGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          campaignId: undefined, // Will go through Google flow
          deploy: { googleAds: true },
          tasks: [{ ...Deploy.createTask("ConnectingGoogle"), status: "completed" }],
        })
        .stopAfter("enqueueDeployCampaign")
        .execute();

      // Should have both ConnectingGoogle and LaunchingCampaign tasks
      const googleTask = result.state.tasks.find((t) => t.name === "ConnectingGoogle");
      const deployTask = result.state.tasks.find((t) => t.name === "LaunchingCampaign");

      expect(googleTask?.status).toBe("completed");
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

      // LaunchingCampaign phase should be running
      const deployPhase = result.state.phases.find((p) => p.name === "LaunchingCampaign");
      expect(deployPhase?.status).toBe("running");
    });
  });
});
