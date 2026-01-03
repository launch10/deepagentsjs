import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemorySaver, isGraphInterrupt } from "@langchain/langgraph";
import { launchGraph } from "@graphs";
import type { LaunchGraphState } from "@annotation";
import type { ThreadIDType } from "@types";

// Mock the JobRunAPIService
vi.mock("@services", () => ({
  JobRunAPIService: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({ id: 123, status: "pending" }),
  })),
}));

describe("Launch Graph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Full workflow: interrupt and resume pattern", () => {
    it("interrupts on first invocation, completes on second invocation with job result", async () => {
      const checkpointer = new MemorySaver();
      const graph = launchGraph.compile({ checkpointer });
      const threadId = "test-thread-123";

      // First invocation - should trigger job and interrupt
      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
      };

      let firstResult: any = null;
      let interruptError: any = null;

      try {
        firstResult = await graph.invoke(initialState, {
          configurable: { thread_id: threadId },
        });
      } catch (error: any) {
        interruptError = error;
      }

      // Verify interrupt occurred
      const wasInterrupted =
        (firstResult && firstResult.__interrupt__) || isGraphInterrupt(interruptError);
      expect(!!wasInterrupted).toBe(true);

      // Get the interrupt value
      let interruptValue: any;
      if (firstResult && firstResult.__interrupt__) {
        interruptValue = firstResult.__interrupt__[0].value;
      } else if (interruptError) {
        interruptValue = interruptError.interrupts[0].value;
      }

      expect(interruptValue).toEqual({
        reason: "waiting_for_job",
        jobRunId: 123,
        jobClass: "CampaignDeployWorker",
      });

      // Second invocation - resume with job completion data
      // This simulates what the webhook callback does: update state and resume
      const resumeState: Partial<LaunchGraphState> = {
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

      const finalResult = await graph.invoke(resumeState, {
        configurable: { thread_id: threadId },
      });

      expect(finalResult.deployStatus).toBe("completed");
      expect(finalResult.deployResult).toEqual({
        campaign_id: 456,
        external_id: "ext_789",
        deployed_at: "2024-01-15T10:00:00Z",
      });
      expect(finalResult.jobRunComplete).toBeUndefined();
    });

    it("handles job failure on resume", async () => {
      const checkpointer = new MemorySaver();
      const graph = launchGraph.compile({ checkpointer });
      const threadId = "test-thread-failure";

      // First invocation - trigger and interrupt
      const initialState: Partial<LaunchGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        campaignId: 456,
      };

      try {
        await graph.invoke(initialState, {
          configurable: { thread_id: threadId },
        });
      } catch {
        // Expected interrupt
      }

      // Resume with failure
      const resumeState: Partial<LaunchGraphState> = {
        jobRunComplete: {
          jobRunId: 123,
          status: "failed",
          error: "API rate limit exceeded",
        },
      };

      const finalResult = await graph.invoke(resumeState, {
        configurable: { thread_id: threadId },
      });

      expect(finalResult.deployStatus).toBe("failed");
      expect(finalResult.error).toEqual({
        message: "API rate limit exceeded",
        node: "deployCampaignNode",
      });
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
        },
        { configurable: { thread_id: "test" } }
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
        },
        { configurable: { thread_id: "test" } }
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
        },
        { configurable: { thread_id: "test" } }
      );

      expect(result.error).toBeDefined();
      expect(result.error!.message).toBe("Campaign ID is required");
    });
  });

  describe("Direct completion (when jobRunComplete already present)", () => {
    it("skips job creation when jobRunComplete is already in state", async () => {
      const checkpointer = new MemorySaver();
      const graph = launchGraph.compile({ checkpointer });

      // Invoke directly with jobRunComplete (as if resuming after webhook)
      const result = await graph.invoke(
        {
          jwt: "test-jwt",
          threadId: "thread_123" as ThreadIDType,
          campaignId: 456,
          jobRunComplete: {
            jobRunId: 999,
            status: "completed",
            result: { success: true },
          },
        },
        { configurable: { thread_id: "direct-completion" } }
      );

      expect(result.deployStatus).toBe("completed");
      expect(result.deployResult).toEqual({ success: true });
      expect(result.jobRunComplete).toBeUndefined();
    });
  });
});
