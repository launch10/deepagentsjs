import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateCreditStatusNode } from "@nodes";
import type { CoreGraphState, ThreadIDType } from "@types";

// Mock dependencies
vi.mock("@core/billing", async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    getUsageContext: vi.fn(),
  };
});

vi.mock("@core", async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    LLMManager: {
      getModelConfigs: vi.fn().mockResolvedValue({}),
    },
    calculateRunCost: vi.fn(),
  };
});

import { getUsageContext } from "@core/billing";
import { LLMManager, calculateRunCost } from "@core";

/**
 * Calculate Credit Status Node Tests
 *
 * Tests for the shared graph node that calculates credit status at the end of runs.
 * This node enables the frontend to detect when a user just exhausted their credits.
 */
describe.sequential("calculateCreditStatusNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockState = (overrides: Partial<CoreGraphState> = {}): CoreGraphState => ({
    error: undefined,
    jwt: "test-jwt",
    messages: [],
    threadId: "thread-123" as ThreadIDType,
    accountId: 1,
    projectId: 1,
    projectName: "Test Project",
    websiteId: 1,
    chatId: 1,
    preRunCreditsRemaining: undefined,
    creditStatus: undefined,
    intent: undefined,
    agentIntents: undefined,
    ...overrides,
  });

  describe("when preRunCreditsRemaining is undefined", () => {
    it("returns empty object when no credit tracking was set up", async () => {
      const state = createMockState({ preRunCreditsRemaining: undefined });

      const result = await calculateCreditStatusNode(state);

      expect(result).toEqual({});
    });
  });

  describe("when no usage was recorded", () => {
    it("returns creditStatus with no change when no LLM calls were made", async () => {
      vi.mocked(getUsageContext).mockReturnValue(undefined);

      const state = createMockState({ preRunCreditsRemaining: 5000 });

      const result = await calculateCreditStatusNode(state);

      expect(result.creditStatus).toEqual({
        justExhausted: false,
        estimatedRemainingMillicredits: 5000,
        preRunMillicredits: 5000,
        estimatedCostMillicredits: 0,
      });
    });

    it("returns creditStatus with no change when records array is empty", async () => {
      vi.mocked(getUsageContext).mockReturnValue({
        runId: "run-123",
        records: [],
        messages: [],
        _seenMessageIds: new Set(),
        _runIdToMetadata: new Map(),
      });

      const state = createMockState({ preRunCreditsRemaining: 5000 });

      const result = await calculateCreditStatusNode(state);

      expect(result.creditStatus).toEqual({
        justExhausted: false,
        estimatedRemainingMillicredits: 5000,
        preRunMillicredits: 5000,
        estimatedCostMillicredits: 0,
      });
    });
  });

  describe("when usage was recorded", () => {
    it("calculates credit status based on usage", async () => {
      vi.mocked(getUsageContext).mockReturnValue({
        runId: "run-123",
        records: [
          {
            runId: "run-123",
            messageId: "msg-1",
            langchainRunId: "lc-1",
            model: "claude-haiku",
            inputTokens: 100,
            outputTokens: 50,
            reasoningTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            timestamp: new Date(),
          },
        ],
        messages: [],
        _seenMessageIds: new Set(),
        _runIdToMetadata: new Map(),
      });

      vi.mocked(calculateRunCost).mockReturnValue(1000); // 1 credit

      const state = createMockState({ preRunCreditsRemaining: 5000 });

      const result = await calculateCreditStatusNode(state);

      expect(result.creditStatus).toEqual({
        justExhausted: false,
        estimatedRemainingMillicredits: 4000,
        preRunMillicredits: 5000,
        estimatedCostMillicredits: 1000,
      });
    });

    it("sets justExhausted=true when credits drop to zero", async () => {
      vi.mocked(getUsageContext).mockReturnValue({
        runId: "run-123",
        records: [
          {
            runId: "run-123",
            messageId: "msg-1",
            langchainRunId: "lc-1",
            model: "claude-sonnet",
            inputTokens: 1000,
            outputTokens: 500,
            reasoningTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            timestamp: new Date(),
          },
        ],
        messages: [],
        _seenMessageIds: new Set(),
        _runIdToMetadata: new Map(),
      });

      vi.mocked(calculateRunCost).mockReturnValue(5000); // Exactly exhausts balance

      const state = createMockState({ preRunCreditsRemaining: 5000 });

      const result = await calculateCreditStatusNode(state);

      expect(result.creditStatus?.justExhausted).toBe(true);
      expect(result.creditStatus?.estimatedRemainingMillicredits).toBe(0);
    });

    it("sets justExhausted=true when credits go negative", async () => {
      vi.mocked(getUsageContext).mockReturnValue({
        runId: "run-123",
        records: [
          {
            runId: "run-123",
            messageId: "msg-1",
            langchainRunId: "lc-1",
            model: "claude-sonnet",
            inputTokens: 5000,
            outputTokens: 2500,
            reasoningTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            timestamp: new Date(),
          },
        ],
        messages: [],
        _seenMessageIds: new Set(),
        _runIdToMetadata: new Map(),
      });

      vi.mocked(calculateRunCost).mockReturnValue(10000); // Exceeds balance

      const state = createMockState({ preRunCreditsRemaining: 5000 });

      const result = await calculateCreditStatusNode(state);

      expect(result.creditStatus?.justExhausted).toBe(true);
      expect(result.creditStatus?.estimatedRemainingMillicredits).toBe(-5000);
    });
  });

  describe("error handling", () => {
    it("returns empty object when getModelConfigs throws", async () => {
      vi.mocked(getUsageContext).mockReturnValue({
        runId: "run-123",
        records: [
          {
            runId: "run-123",
            messageId: "msg-1",
            langchainRunId: "lc-1",
            model: "claude-haiku",
            inputTokens: 100,
            outputTokens: 50,
            reasoningTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            timestamp: new Date(),
          },
        ],
        messages: [],
        _seenMessageIds: new Set(),
        _runIdToMetadata: new Map(),
      });

      vi.mocked(LLMManager.getModelConfigs).mockRejectedValue(new Error("Failed to fetch configs"));

      const state = createMockState({ preRunCreditsRemaining: 5000 });

      // Should not throw, just return empty object
      const result = await calculateCreditStatusNode(state);

      expect(result).toEqual({});
    });

    it("returns empty object when calculateRunCost throws", async () => {
      vi.mocked(getUsageContext).mockReturnValue({
        runId: "run-123",
        records: [
          {
            runId: "run-123",
            messageId: "msg-1",
            langchainRunId: "lc-1",
            model: "unknown-model",
            inputTokens: 100,
            outputTokens: 50,
            reasoningTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            timestamp: new Date(),
          },
        ],
        messages: [],
        _seenMessageIds: new Set(),
        _runIdToMetadata: new Map(),
      });

      vi.mocked(calculateRunCost).mockImplementation(() => {
        throw new Error("Failed to calculate cost");
      });

      const state = createMockState({ preRunCreditsRemaining: 5000 });

      // Should not throw, just return empty object
      const result = await calculateCreditStatusNode(state);

      expect(result).toEqual({});
    });
  });
});
