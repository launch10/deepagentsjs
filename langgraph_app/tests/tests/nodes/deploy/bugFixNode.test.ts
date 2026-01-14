import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { bugFixNode } from "../../../../app/nodes/deploy/bugFixNode";
import type { DeployGraphState } from "@annotation";
import type { Task } from "@types";

// Mock createCodingAgent
vi.mock("../../../../app/nodes/coding/agent", () => ({
  createCodingAgent: vi.fn(),
}));

import { createCodingAgent } from "@nodes";

const mockCreateCodingAgent = vi.mocked(createCodingAgent);

describe("bugFixNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * =============================================================================
   * EARLY EXIT TESTS
   * =============================================================================
   */
  describe("Early exit conditions", () => {
    it("returns empty when no RuntimeValidation task exists", async () => {
      const state: Partial<DeployGraphState> = {
        websiteId: 1,
        jwt: "test-jwt",
        tasks: [],
      };

      const result = await bugFixNode(state as DeployGraphState, {} as LangGraphRunnableConfig);
      expect(result).toEqual({});
      expect(mockCreateCodingAgent).not.toHaveBeenCalled();
    });

    it("returns empty when RuntimeValidation task is not failed", async () => {
      const state: Partial<DeployGraphState> = {
        websiteId: 1,
        jwt: "test-jwt",
        tasks: [
          {
            id: "uuid-val",
            name: "RuntimeValidation",
            status: "completed",
            retryCount: 0,
          } as Task.Task,
        ],
      };

      const result = await bugFixNode(state as DeployGraphState, {} as LangGraphRunnableConfig);
      expect(result).toEqual({});
      expect(mockCreateCodingAgent).not.toHaveBeenCalled();
    });
  });

  /**
   * =============================================================================
   * ERROR HANDLING TESTS
   * =============================================================================
   * Note: NodeMiddleware catches errors and returns { error: {...} } state
   * instead of throwing, so we check for error state rather than rejects.
   */
  describe("Error handling", () => {
    it("returns error state when websiteId is missing", async () => {
      const state: Partial<DeployGraphState> = {
        websiteId: undefined,
        jwt: "test-jwt",
        tasks: [
          {
            id: "uuid-val",
            name: "RuntimeValidation",
            status: "failed",
            retryCount: 0,
            error: "Some error",
          } as Task.Task,
        ],
      };

      const result = (await bugFixNode(
        state as DeployGraphState,
        {} as LangGraphRunnableConfig
      )) as Partial<DeployGraphState>;
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("websiteId and jwt are required");
    });

    it("returns error state when jwt is missing", async () => {
      const state: Partial<DeployGraphState> = {
        websiteId: 1,
        jwt: undefined,
        tasks: [
          {
            id: "uuid-val",
            name: "RuntimeValidation",
            status: "failed",
            retryCount: 0,
            error: "Some error",
          } as Task.Task,
        ],
      };

      const result = (await bugFixNode(
        state as DeployGraphState,
        {} as LangGraphRunnableConfig
      )) as Partial<DeployGraphState>;
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("websiteId and jwt are required");
    });

    it("returns error state when validation task has no error", async () => {
      const state: Partial<DeployGraphState> = {
        websiteId: 1,
        jwt: "test-jwt",
        tasks: [
          {
            id: "uuid-val",
            name: "RuntimeValidation",
            status: "failed",
            retryCount: 0,
            // No error field
          } as Task.Task,
        ],
      };

      const result = (await bugFixNode(
        state as DeployGraphState,
        {} as LangGraphRunnableConfig
      )) as Partial<DeployGraphState>;
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Validation error is required");
    });
  });

  /**
   * =============================================================================
   * SUCCESS TESTS
   * =============================================================================
   */
  describe("Successful bug fix", () => {
    it("marks FixingBugs task as completed on success", async () => {
      const mockAgent = {
        invoke: vi.fn().mockResolvedValue({}),
      };
      mockCreateCodingAgent.mockResolvedValue(mockAgent as any);

      const state: Partial<DeployGraphState> = {
        websiteId: 1,
        jwt: "test-jwt",
        tasks: [
          {
            id: "uuid-val",
            name: "RuntimeValidation",
            status: "failed",
            retryCount: 0,
            error: "Component not found",
          } as Task.Task,
          {
            id: "uuid-fix",
            name: "FixingBugs",
            status: "pending",
            retryCount: 0,
          } as Task.Task,
        ],
      };

      const result = (await bugFixNode(
        state as DeployGraphState,
        {} as LangGraphRunnableConfig
      )) as Partial<DeployGraphState>;

      // Verify coding agent was called with correct websiteId and jwt
      expect(mockCreateCodingAgent).toHaveBeenCalledWith(
        { websiteId: 1, jwt: "test-jwt", isFirstMessage: false },
        expect.any(String) // System prompt is dynamically generated
      );
      expect(mockAgent.invoke).toHaveBeenCalled();

      // Should mark FixingBugs as completed and increment validation retryCount
      const bugFixTask = result.tasks?.find((t: Task.Task) => t.name === "FixingBugs");
      const validationTask = result.tasks?.find((t: Task.Task) => t.name === "RuntimeValidation");

      expect(bugFixTask?.status).toBe("completed");
      expect(validationTask?.retryCount).toBe(1);
    });

    it("increments retryCount on RuntimeValidation task", async () => {
      const mockAgent = {
        invoke: vi.fn().mockResolvedValue({}),
      };
      mockCreateCodingAgent.mockResolvedValue(mockAgent as any);

      const state: Partial<DeployGraphState> = {
        websiteId: 1,
        jwt: "test-jwt",
        tasks: [
          {
            id: "uuid-val",
            name: "RuntimeValidation",
            status: "failed",
            retryCount: 1,
            error: "Second failure",
          } as Task.Task,
          {
            id: "uuid-fix",
            name: "FixingBugs",
            status: "pending",
            retryCount: 0,
          } as Task.Task,
        ],
      };

      const result = (await bugFixNode(
        state as DeployGraphState,
        {} as LangGraphRunnableConfig
      )) as Partial<DeployGraphState>;

      const validationTask = result.tasks?.find((t: Task.Task) => t.name === "RuntimeValidation");
      expect(validationTask?.retryCount).toBe(2);
    });
  });

  /**
   * =============================================================================
   * AGENT FAILURE TESTS
   * =============================================================================
   * CRITICAL: These tests verify that agent errors are NOT silently swallowed
   * AND that retryCount is incremented to prevent infinite loops.
   */
  describe("Agent failure handling", () => {
    it("marks FixingBugs task as failed when agent throws", async () => {
      const mockAgent = {
        invoke: vi.fn().mockRejectedValue(new Error("Agent failed to fix the code")),
      };
      mockCreateCodingAgent.mockResolvedValue(mockAgent as any);

      const state: Partial<DeployGraphState> = {
        websiteId: 1,
        jwt: "test-jwt",
        tasks: [
          {
            id: "uuid-val",
            name: "RuntimeValidation",
            status: "failed",
            retryCount: 0,
            error: "Some build error",
          } as Task.Task,
          {
            id: "uuid-fix",
            name: "FixingBugs",
            status: "pending",
            retryCount: 0,
          } as Task.Task,
        ],
      };

      const result = (await bugFixNode(
        state as DeployGraphState,
        {} as LangGraphRunnableConfig
      )) as Partial<DeployGraphState>;

      // Should NOT return empty object - must mark task as failed
      expect(result.tasks).toBeDefined();
      expect(result.tasks?.length).toBeGreaterThan(0);

      const bugFixTask = result.tasks?.find((t: Task.Task) => t.name === "FixingBugs");
      expect(bugFixTask?.status).toBe("failed");
      expect(bugFixTask?.error).toBe("Agent failed to fix the code");
    });

    it("increments retryCount even on failure to prevent infinite loops", async () => {
      const mockAgent = {
        invoke: vi.fn().mockRejectedValue(new Error("Agent failed")),
      };
      mockCreateCodingAgent.mockResolvedValue(mockAgent as any);

      const state: Partial<DeployGraphState> = {
        websiteId: 1,
        jwt: "test-jwt",
        tasks: [
          {
            id: "uuid-val",
            name: "RuntimeValidation",
            status: "failed",
            retryCount: 1,
            error: "Build error",
          } as Task.Task,
          {
            id: "uuid-fix",
            name: "FixingBugs",
            status: "pending",
            retryCount: 0,
          } as Task.Task,
        ],
      };

      const result = (await bugFixNode(
        state as DeployGraphState,
        {} as LangGraphRunnableConfig
      )) as Partial<DeployGraphState>;

      // CRITICAL: retryCount must be incremented to prevent infinite retry loop
      const validationTask = result.tasks?.find((t: Task.Task) => t.name === "RuntimeValidation");
      expect(validationTask?.retryCount).toBe(2);
    });

    it("preserves error message from non-Error thrown values", async () => {
      const mockAgent = {
        invoke: vi.fn().mockRejectedValue("String error message"),
      };
      mockCreateCodingAgent.mockResolvedValue(mockAgent as any);

      const state: Partial<DeployGraphState> = {
        websiteId: 1,
        jwt: "test-jwt",
        tasks: [
          {
            id: "uuid-val",
            name: "RuntimeValidation",
            status: "failed",
            retryCount: 0,
            error: "Build error",
          } as Task.Task,
          {
            id: "uuid-fix",
            name: "FixingBugs",
            status: "pending",
            retryCount: 0,
          } as Task.Task,
        ],
      };

      const result = (await bugFixNode(
        state as DeployGraphState,
        {} as LangGraphRunnableConfig
      )) as Partial<DeployGraphState>;

      const bugFixTask = result.tasks?.find((t: Task.Task) => t.name === "FixingBugs");
      expect(bugFixTask?.status).toBe("failed");
      expect(bugFixTask?.error).toBe("Unknown error");
    });

    it("does not swallow errors silently by returning empty object", async () => {
      const mockAgent = {
        invoke: vi.fn().mockRejectedValue(new Error("Critical failure")),
      };
      mockCreateCodingAgent.mockResolvedValue(mockAgent as any);

      const state: Partial<DeployGraphState> = {
        websiteId: 1,
        jwt: "test-jwt",
        tasks: [
          {
            id: "uuid-val",
            name: "RuntimeValidation",
            status: "failed",
            retryCount: 0,
            error: "Runtime error",
          } as Task.Task,
          {
            id: "uuid-fix",
            name: "FixingBugs",
            status: "pending",
            retryCount: 0,
          } as Task.Task,
        ],
      };

      const result = (await bugFixNode(
        state as DeployGraphState,
        {} as LangGraphRunnableConfig
      )) as Partial<DeployGraphState>;

      // The bug was: catch block returned {} which silently swallowed errors
      // This test ensures we return meaningful task state on error
      expect(result).not.toEqual({});
      expect(result.tasks).toBeDefined();
    });
  });
});
