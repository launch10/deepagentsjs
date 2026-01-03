import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemorySaver } from "@langchain/langgraph";
import { launchGraph } from "@graphs";
import type { LaunchGraphState } from "@annotation";
import type { ThreadIDType, AsyncTask } from "@types";

// Mock the JobRunAPIService
vi.mock("@services", () => ({
  JobRunAPIService: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({ id: 123, status: "pending" }),
  })),
}));

describe("Launch Graph (idempotent pattern)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Full workflow: fire-and-forget + webhook pattern", () => {
    it("first invocation fires job and returns pending, second invocation with result completes", async () => {
      const checkpointer = new MemorySaver();
      const graph = launchGraph.compile({ checkpointer });
      const threadId = "test-thread-123";

      // First invocation - should trigger job and return pending
      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        tasks: [],
      };

      const firstResult = await graph.invoke(initialState, {
        configurable: { thread_id: threadId },
      });

      // Should have pending status and task
      expect(firstResult.deployStatus).toBe("pending");
      expect(firstResult.tasks).toHaveLength(1);
      expect(firstResult.tasks[0]!.name).toBe("deployCampaign");
      expect(firstResult.tasks[0]!.status).toBe("pending");
      expect(firstResult.tasks[0]!.jobId).toBe(123);

      // Simulate webhook updating the task with result
      // This is what the webhook handler does
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
      const secondResult = await graph.invoke(
        {},
        { configurable: { thread_id: threadId } }
      );

      // Should have processed the result
      expect(secondResult.deployStatus).toBe("completed");
      expect(secondResult.deployResult).toEqual({
        campaign_id: 456,
        external_id: "ext_789",
        deployed_at: "2024-01-15T10:00:00Z",
      });
      expect(secondResult.tasks[0]!.status).toBe("completed");
    });

    it("handles job failure from webhook", async () => {
      const checkpointer = new MemorySaver();
      const graph = launchGraph.compile({ checkpointer });
      const threadId = "test-thread-failure";

      // First invocation
      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
        tasks: [],
      };

      const firstResult = await graph.invoke(initialState, {
        configurable: { thread_id: threadId },
      });

      expect(firstResult.deployStatus).toBe("pending");

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
      const secondResult = await graph.invoke(
        {},
        { configurable: { thread_id: threadId } }
      );

      expect(secondResult.deployStatus).toBe("failed");
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
      const graph = launchGraph.compile({ checkpointer });
      const threadId = "test-thread-polling";

      // First invocation - fires job
      const firstResult = await graph.invoke(
        {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          tasks: [],
        },
        { configurable: { thread_id: threadId } }
      );

      expect(firstResult.deployStatus).toBe("pending");

      // Get current state (simulates what frontend would see)
      const state = await graph.getState({ configurable: { thread_id: threadId } });

      // Status should still be pending - the state persists between invocations
      expect(state?.values?.deployStatus).toBe("pending");
      expect(state?.values?.tasks[0]!.status).toBe("pending");
    });
  });

  describe("Idempotency (multiple invocations after completion)", () => {
    it("returns no-op when already completed", async () => {
      const checkpointer = new MemorySaver();
      const graph = launchGraph.compile({ checkpointer });
      const threadId = "test-thread-idempotent";

      // Start with already completed state
      const completedTask: AsyncTask = {
        id: "uuid-123",
        name: "deployCampaign",
        jobId: 123,
        status: "completed",
        result: { success: true },
      };

      const result = await graph.invoke(
        {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          tasks: [completedTask],
          deployStatus: "completed",
          deployResult: { success: true },
        },
        { configurable: { thread_id: threadId } }
      );

      // Should not change anything
      expect(result.deployStatus).toBe("completed");
      expect(result.tasks[0]!.status).toBe("completed");
    });
  });

  describe("Validation errors", () => {
    it("sets error when JWT is missing", async () => {
      const checkpointer = new MemorySaver();
      const graph = launchGraph.compile({ checkpointer });

      const result = await graph.invoke(
        {
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          tasks: [],
        },
        { configurable: { thread_id: "test-jwt-missing" } }
      );

      expect(result.error).toBeDefined();
      expect(result.error!.message).toBe("JWT token is required for API authentication");
    });

    it("sets error when threadId is missing", async () => {
      const checkpointer = new MemorySaver();
      const graph = launchGraph.compile({ checkpointer });

      const result = await graph.invoke(
        {
          jwt: "test-jwt",
          campaignId: 456,
          tasks: [],
        },
        { configurable: { thread_id: "test-threadid-missing" } }
      );

      expect(result.error).toBeDefined();
      expect(result.error!.message).toBe("Thread ID is required");
    });

    it("sets error when campaignId is missing", async () => {
      const checkpointer = new MemorySaver();
      const graph = launchGraph.compile({ checkpointer });

      const result = await graph.invoke(
        {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          tasks: [],
        },
        { configurable: { thread_id: "test-campaignid-missing" } }
      );

      expect(result.error).toBeDefined();
      expect(result.error!.message).toBe("Campaign ID is required");
    });
  });
});
