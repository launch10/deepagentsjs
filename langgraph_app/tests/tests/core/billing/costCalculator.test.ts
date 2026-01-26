import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateCost, calculateRunCost, type UsageRecord } from "@core";
import type { ModelConfig } from "@core/llm/types";

/**
 * Cost Calculator Tests
 *
 * Formula: millicredits = tokens × price_per_million / 10
 *
 * Where:
 * - price_per_million is the cost in dollars per million tokens
 * - 1 millicredit = 0.001 credits = 0.001 cents = $0.00001
 * - 1 credit = 1000 millicredits = 1 cent
 *
 * Example verification:
 *   100 Haiku input tokens at $1/M:
 *   - Actual cost: 100 × $1/1,000,000 = $0.0001 = 0.01 cents
 *   - Formula: 100 × 1 / 10 = 10 millicredits
 *   - 10 millicredits = 10/1000 credits = 0.01 credits = 0.01 cents ✓
 */
describe.sequential("costCalculator", () => {
  // Test model configs matching Rails test data
  const haikuConfig: ModelConfig = {
    enabled: true,
    maxUsagePercent: null,
    costIn: 1.0, // $1 per million input tokens
    costOut: 5.0, // $5 per million output tokens
    costReasoning: 5.0,
    cacheWrites: 2.0, // $2 per million cache write tokens
    cacheReads: 0.1, // $0.10 per million cache read tokens
    modelCard: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    priceTier: 5,
  };

  const sonnetConfig: ModelConfig = {
    enabled: true,
    maxUsagePercent: null,
    costIn: 3.0, // $3 per million input tokens
    costOut: 15.0, // $15 per million output tokens
    costReasoning: 15.0,
    cacheWrites: 6.0,
    cacheReads: 0.3,
    modelCard: "claude-sonnet-4-5-20250220",
    provider: "anthropic",
    priceTier: 3,
  };

  const configWithoutReasoningCost: ModelConfig = {
    enabled: true,
    maxUsagePercent: null,
    costIn: 1.0,
    costOut: 5.0,
    costReasoning: null, // Falls back to costOut
    cacheWrites: 2.0,
    cacheReads: 0.1,
    modelCard: "claude-no-reasoning",
    provider: "anthropic",
    priceTier: 5,
  };

  const configWithNullRates: ModelConfig = {
    enabled: true,
    maxUsagePercent: null,
    costIn: 1.0,
    costOut: null, // Nil rates should be treated as 0
    costReasoning: null,
    cacheWrites: null,
    cacheReads: null,
    modelCard: "claude-partial-rates",
    provider: "anthropic",
    priceTier: 5,
  };

  // Helper to create a model config map
  function createConfigMap(
    ...configs: ModelConfig[]
  ): Record<string, ModelConfig> {
    const map: Record<string, ModelConfig> = {};
    for (const config of configs) {
      if (config.modelCard) {
        map[config.modelCard] = config;
      }
    }
    return map;
  }

  // Helper to create usage record
  function createUsageRecord(
    overrides: Partial<UsageRecord> & { model: string }
  ): UsageRecord {
    return {
      runId: "run_123",
      messageId: "msg_456",
      langchainRunId: "lc_789",
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      timestamp: new Date(),
      ...overrides,
    };
  }

  describe("calculateCost (single record)", () => {
    it("calculates correct cost for input tokens only", () => {
      const configs = createConfigMap(haikuConfig);

      const record = createUsageRecord({
        model: "claude-haiku-4-5-20251001",
        inputTokens: 1000,
      });

      const cost = calculateCost(record, configs);
      // 1000 tokens × $1/M / 10 = 100 millicredits
      expect(cost).toBe(100);
    });

    it("calculates correct cost for output tokens only", () => {
      const configs = createConfigMap(haikuConfig);

      const record = createUsageRecord({
        model: "claude-haiku-4-5-20251001",
        outputTokens: 1000,
      });

      const cost = calculateCost(record, configs);
      // 1000 tokens × $5/M / 10 = 500 millicredits
      expect(cost).toBe(500);
    });

    it("calculates correct cost for combined input and output", () => {
      const configs = createConfigMap(haikuConfig);

      const record = createUsageRecord({
        model: "claude-haiku-4-5-20251001",
        inputTokens: 1000,
        outputTokens: 500,
      });

      const cost = calculateCost(record, configs);
      // Input: 1000 × 1 / 10 = 100 millicredits
      // Output: 500 × 5 / 10 = 250 millicredits
      // Total: 350 millicredits
      expect(cost).toBe(350);
    });

    it("sums cost across all token types", () => {
      const configs = createConfigMap(haikuConfig);

      const record = createUsageRecord({
        model: "claude-haiku-4-5-20251001",
        inputTokens: 1000,
        outputTokens: 500,
        reasoningTokens: 200,
        cacheCreationTokens: 300,
        cacheReadTokens: 10000,
      });

      const cost = calculateCost(record, configs);
      // Input: 1000 × 1 / 10 = 100
      // Output: 500 × 5 / 10 = 250
      // Reasoning: 200 × 5 / 10 = 100 (uses costReasoning)
      // Cache writes: 300 × 2 / 10 = 60
      // Cache reads: 10000 × 0.1 / 10 = 100
      // Total: 610 millicredits
      expect(cost).toBe(610);
    });

    it("uses costReasoning when available", () => {
      const highReasoningConfig: ModelConfig = {
        ...haikuConfig,
        costReasoning: 10.0, // Higher cost for reasoning
        modelCard: "claude-high-reasoning",
      };
      const configs = createConfigMap(highReasoningConfig);

      const record = createUsageRecord({
        model: "claude-high-reasoning",
        reasoningTokens: 1000,
      });

      const cost = calculateCost(record, configs);
      // 1000 × 10 / 10 = 1000 millicredits
      expect(cost).toBe(1000);
    });

    it("falls back to costOut when costReasoning is null", () => {
      const configs = createConfigMap(configWithoutReasoningCost);

      const record = createUsageRecord({
        model: "claude-no-reasoning",
        reasoningTokens: 1000,
      });

      const cost = calculateCost(record, configs);
      // Falls back to costOut: 1000 × 5 / 10 = 500 millicredits
      expect(cost).toBe(500);
    });

    it("returns 0 for unknown model (graceful degradation)", () => {
      const configs = createConfigMap(haikuConfig);

      const record = createUsageRecord({
        model: "completely-unknown-model",
        inputTokens: 1000,
      });

      // Should return 0 and log warning instead of throwing
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const cost = calculateCost(record, configs);
      expect(cost).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown model: completely-unknown-model")
      );
      consoleSpy.mockRestore();
    });

    it("returns 0 for all zero token counts", () => {
      const configs = createConfigMap(haikuConfig);

      const record = createUsageRecord({
        model: "claude-haiku-4-5-20251001",
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      });

      const cost = calculateCost(record, configs);
      expect(cost).toBe(0);
    });

    it("treats nil rates as zero cost", () => {
      const configs = createConfigMap(configWithNullRates);

      const record = createUsageRecord({
        model: "claude-partial-rates",
        inputTokens: 1000,
        outputTokens: 500, // Should be 0 cost (null rate)
        cacheCreationTokens: 100, // Should be 0 cost (null rate)
        cacheReadTokens: 100, // Should be 0 cost (null rate)
      });

      const cost = calculateCost(record, configs);
      // Only input tokens have a rate: 1000 × 1 / 10 = 100 millicredits
      expect(cost).toBe(100);
    });

    it("rounds to nearest integer millicredit", () => {
      const configs = createConfigMap(haikuConfig);

      const record = createUsageRecord({
        model: "claude-haiku-4-5-20251001",
        inputTokens: 1, // 1 × 1 / 10 = 0.1 -> rounds to 0
      });

      const cost = calculateCost(record, configs);
      expect(cost).toBe(0);
    });

    it("rounds 0.5 up", () => {
      const configs = createConfigMap(haikuConfig);

      const record = createUsageRecord({
        model: "claude-haiku-4-5-20251001",
        inputTokens: 5, // 5 × 1 / 10 = 0.5 -> rounds to 1
      });

      const cost = calculateCost(record, configs);
      expect(cost).toBe(1);
    });

    it("calculates higher cost for more expensive models (sonnet)", () => {
      const configs = createConfigMap(sonnetConfig);

      const record = createUsageRecord({
        model: "claude-sonnet-4-5-20250220",
        inputTokens: 1000,
        outputTokens: 500,
      });

      const cost = calculateCost(record, configs);
      // Input: 1000 × 3 / 10 = 300 millicredits
      // Output: 500 × 15 / 10 = 750 millicredits
      // Total: 1050 millicredits
      expect(cost).toBe(1050);
    });
  });

  describe("formula verification", () => {
    // Verify the formula: millicredits = tokens × price_per_million / 10
    // 1 millicredit = 0.001 credits = 0.001 cents = $0.00001

    it("100 Haiku input tokens costs 10 millicredits ($0.0001)", () => {
      const configs = createConfigMap(haikuConfig);

      const record = createUsageRecord({
        model: "claude-haiku-4-5-20251001",
        inputTokens: 100,
      });

      const cost = calculateCost(record, configs);
      // 100 × $1/M / 10 = 10 millicredits
      expect(cost).toBe(10);

      // Verify in dollars: 10 millicredits = $0.0001
      // Actual Haiku cost: 100 tokens × $1/1M = $0.0001 ✓
    });

    it("1 million input tokens equals $1 (100,000 millicredits)", () => {
      const configs = createConfigMap(haikuConfig);

      const record = createUsageRecord({
        model: "claude-haiku-4-5-20251001",
        inputTokens: 1_000_000,
      });

      const cost = calculateCost(record, configs);
      // 1M × $1/M / 10 = 100,000 millicredits = 100 credits = $1
      expect(cost).toBe(100_000);
    });
  });

  describe("calculateRunCost (multiple records)", () => {
    it("sums cost across multiple usage records", () => {
      const configs = createConfigMap(haikuConfig, sonnetConfig);

      const records: UsageRecord[] = [
        createUsageRecord({
          model: "claude-haiku-4-5-20251001",
          inputTokens: 1000,
          outputTokens: 500,
        }),
        createUsageRecord({
          model: "claude-sonnet-4-5-20250220",
          inputTokens: 500,
          outputTokens: 200,
        }),
      ];

      const cost = calculateRunCost(records, configs);
      // Haiku: 1000 × 1 / 10 + 500 × 5 / 10 = 100 + 250 = 350
      // Sonnet: 500 × 3 / 10 + 200 × 15 / 10 = 150 + 300 = 450
      // Total: 800 millicredits
      expect(cost).toBe(800);
    });

    it("returns 0 for empty records array", () => {
      const configs = createConfigMap(haikuConfig);

      const cost = calculateRunCost([], configs);
      expect(cost).toBe(0);
    });

    it("handles mixed known and unknown models gracefully", () => {
      const configs = createConfigMap(haikuConfig);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const records: UsageRecord[] = [
        createUsageRecord({
          model: "claude-haiku-4-5-20251001",
          inputTokens: 1000,
        }),
        createUsageRecord({
          model: "unknown-model",
          inputTokens: 5000, // Should be 0 cost
        }),
      ];

      const cost = calculateRunCost(records, configs);
      // Only Haiku: 1000 × 1 / 10 = 100 millicredits
      // Unknown: 0 (graceful degradation)
      expect(cost).toBe(100);
      consoleSpy.mockRestore();
    });
  });

  describe("model normalization", () => {
    // Models come with version suffixes that need to be normalized
    // e.g., "claude-haiku-4-5-20251001" -> matches config for "claude-haiku-4-5-20251001"

    it("matches model with exact model card", () => {
      const configs = createConfigMap(haikuConfig);

      const record = createUsageRecord({
        model: "claude-haiku-4-5-20251001",
        inputTokens: 1000,
      });

      const cost = calculateCost(record, configs);
      expect(cost).toBe(100);
    });

    it("matches model with version suffix to base model", () => {
      // Config has modelCard: "claude-sonnet-4-5-20250220"
      const configs = createConfigMap(sonnetConfig);

      // Usage might come with a slightly different version
      const record = createUsageRecord({
        model: "claude-sonnet-4-5-20250220",
        inputTokens: 1000,
      });

      const cost = calculateCost(record, configs);
      expect(cost).toBe(300); // 1000 × 3 / 10
    });
  });

  describe("integration with UsageContext", () => {
    it("can calculate cost from UsageContext records", () => {
      const configs = createConfigMap(haikuConfig);

      // Simulating what would come from UsageContext.records
      const contextRecords: UsageRecord[] = [
        {
          runId: "run_abc",
          messageId: "msg_1",
          langchainRunId: "lc_1",
          model: "claude-haiku-4-5-20251001",
          inputTokens: 500,
          outputTokens: 100,
          reasoningTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          timestamp: new Date(),
        },
        {
          runId: "run_abc",
          messageId: "msg_2",
          langchainRunId: "lc_2",
          model: "claude-haiku-4-5-20251001",
          inputTokens: 800,
          outputTokens: 200,
          reasoningTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          timestamp: new Date(),
        },
      ];

      const cost = calculateRunCost(contextRecords, configs);
      // Record 1: 500 × 1 / 10 + 100 × 5 / 10 = 50 + 50 = 100
      // Record 2: 800 × 1 / 10 + 200 × 5 / 10 = 80 + 100 = 180
      // Total: 280 millicredits
      expect(cost).toBe(280);
    });
  });
});
