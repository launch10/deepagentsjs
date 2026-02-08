import { describe, it, expect } from "vitest";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { DeployGraphState } from "@annotation";
import type { Task } from "@types";

import { bugFixNode } from "@nodes";

describe("bugFixNode", () => {
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

    it("skips bug fix when retryCount exceeds max retries", async () => {
      const state: Partial<DeployGraphState> = {
        websiteId: 1,
        jwt: "test-jwt",
        tasks: [
          {
            id: "uuid-val",
            name: "RuntimeValidation",
            status: "failed",
            retryCount: 2,
            error: "Persistent error",
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
      expect(bugFixTask?.error).toContain("Max bug fix retries");
    });
  });
});
