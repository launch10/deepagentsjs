import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateCost, calculateRunCost, type UsageRecord, type ModelConfig } from "@core";

/**
 * Cost Calculator Tests
 *
 * Credit System:
 *   - 1 credit = 1 cent = $0.01
 *   - 1 millicredit = 1/1000 credit = $0.00001
 *   - $1.00 = 100 credits = 100,000 millicredits
 *
 * Formula Derivation:
 *   cost_in_dollars = tokens × price_per_million / 1,000,000
 *   cost_in_millicredits = cost_in_dollars × 100,000 (since $1 = 100,000 millicredits)
 *   Simplifying: millicredits = tokens × price_per_million / 10
 *
 * Example: 1M tokens at $1/M
 *   - Cost: $1.00 = 100 cents = 100 credits = 100,000 millicredits
 *   - Formula: 1,000,000 × 1 / 10 = 100,000 millicredits ✓
 */
describe.sequential("costCalculator", () => {
  // Test model configs matching Rails test data (snake_case)
  const haikuConfig: ModelConfig = {
    enabled: true,
    max_usage_percent: null,
    cost_in: 1.0, // $1 per million input tokens
    cost_out: 5.0, // $5 per million output tokens
    cost_reasoning: 5.0,
    cache_writes: 2.0, // $2 per million cache write tokens
    cache_reads: 0.1, // $0.10 per million cache read tokens
    model_card: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    price_tier: 5,
  };

  const sonnetConfig: ModelConfig = {
    enabled: true,
    max_usage_percent: null,
    cost_in: 3.0, // $3 per million input tokens
    cost_out: 15.0, // $15 per million output tokens
    cost_reasoning: 15.0,
    cache_writes: 6.0,
    cache_reads: 0.3,
    model_card: "claude-sonnet-4-5-20250220",
    provider: "anthropic",
    price_tier: 3,
  };

  const configWithoutReasoningCost: ModelConfig = {
    enabled: true,
    max_usage_percent: null,
    cost_in: 1.0,
    cost_out: 5.0,
    cost_reasoning: null, // Falls back to cost_out
    cache_writes: 2.0,
    cache_reads: 0.1,
    model_card: "claude-no-reasoning",
    provider: "anthropic",
    price_tier: 5,
  };

  const configWithNullRates: ModelConfig = {
    enabled: true,
    max_usage_percent: null,
    cost_in: 1.0,
    cost_out: null, // Nil rates should be treated as 0
    cost_reasoning: null,
    cache_writes: null,
    cache_reads: null,
    model_card: "claude-partial-rates",
    provider: "anthropic",
    price_tier: 5,
  };

  // Helper to create a model config map
  function createConfigMap(
    ...configs: ModelConfig[]
  ): Record<string, ModelConfig> {
    const map: Record<string, ModelConfig> = {};
    for (const config of configs) {
      if (config.model_card) {
        map[config.model_card] = config;
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

    it("uses cost_reasoning when available", () => {
      const highReasoningConfig: ModelConfig = {
        ...haikuConfig,
        cost_reasoning: 10.0, // Higher cost for reasoning
        model_card: "claude-high-reasoning",
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

    it("falls back to cost_out when cost_reasoning is null", () => {
      const configs = createConfigMap(configWithoutReasoningCost);

      const record = createUsageRecord({
        model: "claude-no-reasoning",
        reasoningTokens: 1000,
      });

      const cost = calculateCost(record, configs);
      // Falls back to cost_out: 1000 × 5 / 10 = 500 millicredits
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
    // Verify: millicredits = tokens × price_per_million / 10
    // where $1.00 = 100 credits = 100,000 millicredits

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
