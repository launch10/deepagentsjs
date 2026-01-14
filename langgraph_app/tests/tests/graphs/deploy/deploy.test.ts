import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemorySaver } from "@langchain/langgraph";
import { testGraph } from "@support";
import { deployGraph as uncompiledGraph } from "@graphs";
import type { DeployGraphState } from "@annotation";
import type { ThreadIDType } from "@types";
import { Deploy } from "@types";
import { graphParams } from "@core";

// Mock the JobRunAPIService
vi.mock("@services", () => ({
  JobRunAPIService: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({ id: 123, status: "pending" }),
  })),
}));

const deployGraph = uncompiledGraph.compile({ ...graphParams, name: "deploy" });

describe.skip("Deploy Graph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("No-op when nothing to deploy", () => {
    it("exits immediately when deployWebsite=false and deployGoogleAds=false", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          websiteId: 1,
          deploy: {
            website: false,
            googleAds: false,
          },
          tasks: [],
        })
        .execute();

      // Should exit without creating any tasks
      expect(result.state.tasks).toHaveLength(0);
    });
  });

  describe("Website deploy flow", () => {
    it("runs instrumentation → validation → deploy when deployWebsite=true", async () => {
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
        .stopAfter("instrumentation")
        .execute();

      // Should have instrumentation task
      const instrumentationTask = result.state.tasks.find((t) => t.name === "AddingAnalytics");
      expect(instrumentationTask).toBeDefined();
      expect(instrumentationTask?.status).toBe("completed");
    });
  });

  describe("First invocation (no task exists)", () => {
    it("creates a job, adds task to tasks[], returns pending status", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          tasks: [],
        })
        .stopAfter("deployCampaign")
        .execute();

      expect(result.state.status).toBe("pending");
      expect(result.state.tasks).toHaveLength(1);
      expect(result.state.tasks[0]!.name).toBe("LaunchingCampaign");
      expect(result.state.tasks[0]!.status).toBe("pending");
      expect(result.state.tasks[0]!.jobId).toBe(123);
    });
  });

  describe("When task is pending/running (waiting for webhook)", () => {
    it("returns no-op when task is pending", async () => {
      const existingTask: Deploy.Task = {
        ...Deploy.createTask("LaunchingCampaign", 123),
        status: "pending",
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          tasks: [existingTask],
          status: "pending",
        })
        .stopAfter("deployCampaign")
        .execute();

      expect(result.state.tasks).toHaveLength(1);
      expect(result.state.tasks[0]!.status).toBe("pending");
      expect(result.state.status).toBe("pending");
    });

    it("returns no-op when task is running but no result yet", async () => {
      const existingTask: Deploy.Task = {
        ...Deploy.createTask("LaunchingCampaign", 123),
        status: "running",
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          tasks: [existingTask],
          status: "pending",
        })
        .stopAfter("deployCampaign")
        .execute();

      expect(result.state.tasks).toHaveLength(1);
      expect(result.state.tasks[0]!.status).toBe("running");
    });
  });

  describe("When webhook delivers result", () => {
    it("processes completed result and marks task as completed", async () => {
      const taskWithResult: Deploy.Task = {
        ...Deploy.createTask("LaunchingCampaign", 123),
        status: "running",
        result: {
          campaign_id: 456,
          external_id: "ext_789",
          deployed_at: "2024-01-15T10:00:00Z",
        },
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          tasks: [taskWithResult],
          status: "pending",
        })
        .stopAfter("deployCampaign")
        .execute();

      expect(result.state.status).toBe("completed");
      expect(result.state.result).toEqual({
        campaign_id: 456,
        external_id: "ext_789",
        deployed_at: "2024-01-15T10:00:00Z",
      });
      expect(result.state.tasks[0]!.status).toBe("completed");
    });

    it("processes failed result and marks task as failed", async () => {
      const taskWithError: Deploy.Task = {
        ...Deploy.createTask("LaunchingCampaign", 123),
        status: "running",
        error: "API rate limit exceeded",
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          tasks: [taskWithError],
          status: "pending",
        })
        .stopAfter("deployCampaign")
        .execute();

      expect(result.state.status).toBe("failed");
      expect(result.state.error).toEqual({
        message: "API rate limit exceeded",
        node: "deployCampaignNode",
      });
      expect(result.state.tasks[0]!.status).toBe("failed");
    });
  });

  describe("Idempotency (already completed/failed)", () => {
    it("returns no-op when task is already completed", async () => {
      const completedTask: Deploy.Task = {
        ...Deploy.createTask("LaunchingCampaign", 123),
        status: "completed",
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          tasks: [completedTask],
          status: "completed",
          result: { success: true },
        })
        .stopAfter("deployCampaign")
        .execute();

      expect(result.state.tasks[0]!.status).toBe("completed");
      expect(result.state.status).toBe("completed");
    });

    it("returns no-op when task is already failed", async () => {
      const failedTask: Deploy.Task = {
        ...Deploy.createTask("LaunchingCampaign", 123),
        status: "failed",
        error: "Some error",
      };

      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          tasks: [failedTask],
          status: "failed",
        })
        .stopAfter("deployCampaign")
        .execute();

      expect(result.state.tasks[0]!.status).toBe("failed");
      expect(result.state.status).toBe("failed");
    });
  });

  describe("Validation errors", () => {
    it("sets error when JWT is missing", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          tasks: [],
          jwt: null as any,
        })
        .stopAfter("deployCampaign")
        .execute();

      expect(result.state.error).toBeDefined();
      expect(result.state.error!.message).toBe("JWT token is required for API authentication");
    });

    it("sets error when threadId is missing", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          campaignId: 456,
          tasks: [],
        })
        .stopAfter("deployCampaign")
        .execute();

      expect(result.state.error).toBeDefined();
      expect(result.state.error!.message).toBe("Thread ID is required");
    });

    it("sets error when campaignId is missing", async () => {
      const result = await testGraph<DeployGraphState>()
        .withGraph(deployGraph)
        .withState({
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          tasks: [],
        })
        .stopAfter("deployCampaign")
        .execute();

      expect(result.state.error).toBeDefined();
      expect(result.state.error!.message).toBe("Campaign ID is required");
    });
  });

  describe("Full workflow: fire-and-forget + webhook pattern", () => {
    it("first invocation fires job and returns pending, second invocation with result completes", async () => {
      const checkpointer = new MemorySaver();
      const graph = uncompiledGraph.compile({ checkpointer });
      const threadId = "test-thread-123";

      const initialState: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        tasks: [],
      };

      const firstResult = await graph.invoke(initialState, {
        configurable: { thread_id: threadId },
      });

      expect(firstResult.status).toBe("pending");
      expect(firstResult.tasks).toHaveLength(1);
      expect(firstResult.tasks[0]!.name).toBe("LaunchingCampaign");
      expect(firstResult.tasks[0]!.status).toBe("pending");
      expect(firstResult.tasks[0]!.jobId).toBe(123);

      // Simulate webhook updating the task with result
      await graph.updateState(
        { configurable: { thread_id: threadId } },
        {
          tasks: [
            {
              ...firstResult.tasks[0]!,
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
      debugger;

      expect(secondResult.status).toBe("completed");
      expect(secondResult.result).toEqual({
        campaign_id: 456,
        external_id: "ext_789",
        deployed_at: "2024-01-15T10:00:00Z",
      });
      expect(secondResult.tasks[0]!.status).toBe("completed");
    });

    it("handles job failure from webhook", async () => {
      const checkpointer = new MemorySaver();
      const graph = uncompiledGraph.compile({ checkpointer });
      const threadId = "test-thread-failure";

      const initialState: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        tasks: [],
      };

      const firstResult = await graph.invoke(initialState, {
        configurable: { thread_id: threadId },
      });

      expect(firstResult.status).toBe("pending");

      // Simulate webhook with error
      await graph.updateState(
        { configurable: { thread_id: threadId } },
        {
          tasks: [
            {
              ...firstResult.tasks[0]!,
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
      expect(secondResult.tasks[0]!.status).toBe("failed");
    });
  });

  describe("Polling behavior (frontend check messages)", () => {
    it("returns no-op when task is pending and waiting", async () => {
      const checkpointer = new MemorySaver();
      const graph = uncompiledGraph.compile({ checkpointer });
      const threadId = "test-thread-polling";

      const firstResult = await graph.invoke(
        {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          tasks: [],
        },
        { configurable: { thread_id: threadId } }
      );

      expect(firstResult.status).toBe("pending");

      // Get current state (simulates what frontend would see)
      const state = await graph.getState({ configurable: { thread_id: threadId } });

      expect(state?.values?.status).toBe("pending");
      expect(state?.values?.tasks[0]!.status).toBe("pending");
    });
  });
});
