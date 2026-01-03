import { describe, it, expect, vi, beforeEach } from "vitest";
import { StateGraph, MemorySaver } from "@langchain/langgraph";
import { LaunchAnnotation, type LaunchGraphState } from "@annotation";
import { deployCampaignNode } from "@nodes";
import type { ThreadIDType, AsyncTask } from "@types";

// Mock the JobRunAPIService
vi.mock("@services", () => ({
  JobRunAPIService: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({ id: 123, status: "pending" }),
  })),
}));

describe("deployCampaignNode (idempotent pattern)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("first invocation (no task exists)", () => {
    it("creates a job, adds task to tasks[], returns pending status", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        tasks: [],
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-thread" },
      });

      // Should have pending deploy status
      expect(result.deployStatus).toBe("pending");

      // Should have created a task in the tasks array
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]!.name).toBe("deployCampaign");
      expect(result.tasks[0]!.status).toBe("pending");
      expect(result.tasks[0]!.jobId).toBe(123);
    });
  });

  describe("when task is pending/running (waiting for webhook)", () => {
    it("returns empty (no-op) when task is pending", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      const existingTask: AsyncTask = {
        id: "uuid-123",
        name: "deployCampaign",
        jobId: 123,
        status: "pending",
      };

      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        tasks: [existingTask],
        deployStatus: "pending",
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-thread-pending" },
      });

      // Should not create a new task - tasks should remain unchanged
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]!.status).toBe("pending");
      // deployStatus should remain pending
      expect(result.deployStatus).toBe("pending");
    });

    it("returns empty (no-op) when task is running but no result yet", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      const existingTask: AsyncTask = {
        id: "uuid-123",
        name: "deployCampaign",
        jobId: 123,
        status: "running",
      };

      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        tasks: [existingTask],
        deployStatus: "pending",
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-thread-running" },
      });

      // Task status should remain running
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]!.status).toBe("running");
    });
  });

  describe("when webhook delivers result", () => {
    it("processes completed result and marks task as completed", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      // Task has result from webhook
      const taskWithResult: AsyncTask = {
        id: "uuid-123",
        name: "deployCampaign",
        jobId: 123,
        status: "running",
        result: {
          campaign_id: 456,
          external_id: "ext_789",
          deployed_at: "2024-01-15T10:00:00Z",
        },
      };

      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        tasks: [taskWithResult],
        deployStatus: "pending",
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-thread-result" },
      });

      // Should process the result
      expect(result.deployStatus).toBe("completed");
      expect(result.deployResult).toEqual({
        campaign_id: 456,
        external_id: "ext_789",
        deployed_at: "2024-01-15T10:00:00Z",
      });

      // Task should be marked as completed
      expect(result.tasks[0]!.status).toBe("completed");
    });

    it("processes failed result and marks task as failed", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      // Task has error from webhook
      const taskWithError: AsyncTask = {
        id: "uuid-123",
        name: "deployCampaign",
        jobId: 123,
        status: "running",
        error: "API rate limit exceeded",
      };

      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        tasks: [taskWithError],
        deployStatus: "pending",
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-thread-error" },
      });

      // Should process the error
      expect(result.deployStatus).toBe("failed");
      expect(result.error).toEqual({
        message: "API rate limit exceeded",
        node: "deployCampaignNode",
      });

      // Task should be marked as failed
      expect(result.tasks[0]!.status).toBe("failed");
    });
  });

  describe("idempotency (already completed/failed)", () => {
    it("returns empty (no-op) when task is already completed", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      const completedTask: AsyncTask = {
        id: "uuid-123",
        name: "deployCampaign",
        jobId: 123,
        status: "completed",
        result: { success: true },
      };

      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        tasks: [completedTask],
        deployStatus: "completed",
        deployResult: { success: true },
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-thread-completed" },
      });

      // Should not change anything
      expect(result.tasks[0]!.status).toBe("completed");
      expect(result.deployStatus).toBe("completed");
    });

    it("returns empty (no-op) when task is already failed", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      const failedTask: AsyncTask = {
        id: "uuid-123",
        name: "deployCampaign",
        jobId: 123,
        status: "failed",
        error: "Some error",
      };

      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        tasks: [failedTask],
        deployStatus: "failed",
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-thread-failed" },
      });

      // Should not change anything
      expect(result.tasks[0]!.status).toBe("failed");
      expect(result.deployStatus).toBe("failed");
    });
  });

  describe("validation errors", () => {
    it("sets error state when JWT is missing", async () => {
      const graph = new StateGraph(LaunchAnnotation)
        .addNode("deployCampaign", deployCampaignNode)
        .addEdge("__start__", "deployCampaign")
        .addEdge("deployCampaign", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      const initialState: Partial<LaunchGraphState> = {
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        tasks: [],
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-jwt-missing" },
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
        tasks: [],
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-threadid-missing" },
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
        tasks: [],
      };

      const result = await graph.invoke(initialState, {
        configurable: { thread_id: "test-campaignid-missing" },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Campaign ID is required");
    });
  });
});
