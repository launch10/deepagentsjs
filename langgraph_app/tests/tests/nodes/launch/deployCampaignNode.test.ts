import { describe, it, expect, vi, beforeEach } from "vitest";
import { StateGraph, MemorySaver, isGraphInterrupt } from "@langchain/langgraph";
import { LaunchAnnotation, type LaunchGraphState } from "@annotation";
import { deployCampaignNode } from "@nodes";
import type { ThreadIDType } from "@types";

// Mock the JobRunAPIService
vi.mock("@services", () => ({
  JobRunAPIService: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({ id: 123, status: "pending" }),
  })),
}));

describe("deployCampaignNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when jobRunComplete is present in state", () => {
    it("handles completed job and returns deploy result", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        jobRunComplete: {
          jobRunId: 123,
          status: "completed",
          result: {
            campaign_id: 456,
            external_id: "ext_789",
            deployed_at: "2024-01-15T10:00:00Z",
          },
        },
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-thread" },
      });

      expect(result.deployStatus).toBe("completed");
      expect(result.deployResult).toEqual({
        campaign_id: 456,
        external_id: "ext_789",
        deployed_at: "2024-01-15T10:00:00Z",
      });
      expect(result.jobRunComplete).toBeUndefined();
    });

    it("handles failed job and sets error state", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        jobRunComplete: {
          jobRunId: 123,
          status: "failed",
          error: "API rate limit exceeded",
        },
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-thread" },
      });

      expect(result.deployStatus).toBe("failed");
      expect(result.error).toEqual({
        message: "API rate limit exceeded",
        node: "deployCampaignNode",
      });
      expect(result.jobRunComplete).toBeUndefined();
    });
  });

  describe("when no jobRunComplete is present", () => {
    it("creates a job run and interrupts", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
      };

      // When using a checkpointer, LangGraph can either:
      // 1. Return a result with __interrupt__ property
      // 2. Throw a GraphInterrupt error
      // We handle both cases
      let result: any = null;
      let caughtError: any = null;

      try {
        result = await graph.invoke(initialState, {
          configurable: { thread_id: "test-thread" },
        });
      } catch (error: any) {
        caughtError = error;
      }

      // Check for interrupt - either in result or as thrown error
      if (result && result.__interrupt__) {
        // Interrupt returned in result (with checkpointer)
        expect(result.__interrupt__).toBeDefined();
        expect(result.__interrupt__[0].value).toEqual({
          reason: "waiting_for_job",
          jobRunId: 123,
          jobClass: "CampaignDeployWorker",
        });
      } else if (caughtError && isGraphInterrupt(caughtError)) {
        // Interrupt thrown as error
        const interrupts = caughtError.interrupts;
        expect(interrupts).toBeDefined();
        expect(interrupts?.[0]?.value).toEqual({
          reason: "waiting_for_job",
          jobRunId: 123,
          jobClass: "CampaignDeployWorker",
        });
      } else {
        // Neither case - fail with helpful message
        throw new Error(
          `Expected graph to interrupt. Result: ${JSON.stringify(result)}, Error: ${caughtError}`
        );
      }
    });

    // The middleware catches errors and sets them as state, so we check the error state
    // instead of expecting the promise to reject
    it("sets error state when JWT is missing", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      const initialState: Partial<LaunchGraphState> = {
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-thread" },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("JWT token is required for API authentication");
    });

    it("sets error state when threadId is missing", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        campaignId: 456,
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-thread" },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Thread ID is required");
    });

    it("sets error state when campaignId is missing", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-thread" },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Campaign ID is required");
    });
  });
});
