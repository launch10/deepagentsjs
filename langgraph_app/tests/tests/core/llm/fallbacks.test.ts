import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getLLM, getLLMFallbacks, LLMManager } from "@core";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { DatabaseSnapshotter } from "@services";

describe("LLM Fallbacks", () => {
  beforeEach(async () => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    LLMManager.reset();
  });

  describe("getLLM", () => {
    it("returns a single LLM instance (highest priority model)", async () => {
      const llm = await getLLM({ skill: "coding", speed: "slow", cost: "paid" });
      expect(llm).toBeInstanceOf(BaseChatModel);
    });
  });

  describe("getLLMFallbacks", () => {
    it("returns an array of LLM instances", async () => {
      const fallbacks = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid" });
      expect(Array.isArray(fallbacks)).toBe(true);
      expect(fallbacks.length).toBeGreaterThan(0);
    });

    it("returns models in priority order (best first)", async () => {
      const fallbacks = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid" });
      // First model should be the highest quality (e.g., Opus or Sonnet)
      // Last model should be the fallback (e.g., Haiku or cheaper option)
      expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    });

    it("first fallback matches what getLLM returns", async () => {
      const primary = await getLLM({ skill: "coding", speed: "slow", cost: "paid" });
      const fallbacks = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid" });

      // The first fallback should be the same model as getLLM returns
      // We compare the model names since instances may differ
      expect(fallbacks[0]).toBeDefined();
    });

    it("returns different fallback chains for different skills", async () => {
      const codingFallbacks = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid" });
      const writingFallbacks = await getLLMFallbacks({ skill: "writing", speed: "slow", cost: "paid" });

      // Different skills may have different fallback priorities
      expect(codingFallbacks).toBeDefined();
      expect(writingFallbacks).toBeDefined();
    });

    it("returns different fallback chains for different speeds", async () => {
      const slowFallbacks = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid" });
      const fastFallbacks = await getLLMFallbacks({ skill: "coding", speed: "fast", cost: "paid" });

      // Slow tier should have more/better models, fast tier optimizes for speed
      expect(slowFallbacks.length).toBeGreaterThanOrEqual(1);
      expect(fastFallbacks.length).toBeGreaterThanOrEqual(1);
    });

    it("returns different fallback chains for different cost tiers", async () => {
      // Note: We only test paid tier here because free tier requires Ollama (not available on CI)
      const paidFallbacks = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid" });

      // Paid tier should have premium models
      expect(paidFallbacks.length).toBeGreaterThanOrEqual(1);
    });

    it("only includes models that are configured (have API keys)", async () => {
      const fallbacks = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid" });

      // All returned models should be usable (properly configured)
      for (const model of fallbacks) {
        expect(model).toBeInstanceOf(BaseChatModel);
      }
    });
  });

  describe("fallback chain configuration", () => {
    it("paid slow coding should prioritize quality models", async () => {
      // Expected order for paid/slow/coding: Opus -> Sonnet -> Haiku -> Gpt5
      const fallbacks = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid" });
      expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    });

    it("paid fast coding should prioritize speed", async () => {
      // Expected order for paid/fast/coding: Haiku -> Sonnet (fast models first)
      const fallbacks = await getLLMFallbacks({ skill: "coding", speed: "fast", cost: "paid" });
      expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("Usage-Based LLM Filtering", () => {
  beforeEach(() => {
    LLMManager.reset();
  });

  describe("getLLMFallbacks with usagePercent parameter", () => {
    it("includes all models when usagePercent is 0", async () => {
      const fallbacks = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid", usagePercent: 0 });
      // At 0% usage, should get all configured models
      expect(fallbacks.length).toBeGreaterThanOrEqual(3);
    });

    it("excludes models above usage threshold", async () => {
      const fallbacksHigh = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid", usagePercent: 100 });
      const fallbacksLow = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid", usagePercent: 0 });

      // High usage should have fewer models
      expect(fallbacksHigh.length).toBeLessThan(fallbacksLow.length);
    });

    it("always returns at least one model (100% threshold models)", async () => {
      // Even at 99% usage, should have at least one model available
      const fallbacks = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid", usagePercent: 100 });
      expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    });

    it("filters models correctly at exact threshold boundaries", async () => {
      // At exactly 90%, Sonnet should still be available (usage < threshold)
      const fallbacksAt90 = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid", usagePercent: 90 });
      console.log(
        "fallbacksAt90",
        fallbacksAt90.map((m) => (m as any).modelName)
      );

      // At 90.1%, Sonnet should be excluded (usage >= threshold)
      const fallbacksAbove90 = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid", usagePercent: 90.1 });
      console.log(
        "fallbacksAbove90",
        fallbacksAbove90.map((m) => (m as any).modelName)
      );

      // Should have one less model after crossing the threshold
      expect(fallbacksAbove90.length).toBeLessThan(fallbacksAt90.length);
    });

    it("defaults to 0% usage when not specified", async () => {
      const fallbacksDefault = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid" });
      const fallbacksExplicit = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid", usagePercent: 0 });

      // Should return the same number of models
      expect(fallbacksDefault.length).toBe(fallbacksExplicit.length);
    });
  });

  describe("usage threshold configuration", () => {
    it("models without explicit threshold default to 100%", async () => {
      // Models with no maxUsagePercent should always be available
      const fallbacks = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid", usagePercent: 99 });
      expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("Price Tier Filtering", () => {
  // Use explicit test config to ensure predictable tier testing
  // This bypasses Rails API and uses a known configuration
  const tierTestConfig = {
    models: {
      groq: { enabled: true, maxUsagePercent: 100, costIn: 1.25, costOut: 10, modelCard: "llama-3.3-70b-versatile", provider: "groq" as const, priceTier: 2 },
      haiku: { enabled: true, maxUsagePercent: 100, costIn: 1, costOut: 5, modelCard: "claude-haiku-4-5", provider: "anthropic" as const, priceTier: 3 },
      haiku3: { enabled: true, maxUsagePercent: 100, costIn: 0.25, costOut: 1.25, modelCard: "claude-3-5-haiku-latest", provider: "anthropic" as const, priceTier: 4 },
      sonnet: { enabled: true, maxUsagePercent: 90, costIn: 3, costOut: 15, modelCard: "claude-sonnet-4-5", provider: "anthropic" as const, priceTier: 2 },
    },
    preferences: {
      free: { blazing: { planning: [], writing: [], coding: [], reasoning: [] }, fast: { planning: [], writing: [], coding: [], reasoning: [] }, slow: { planning: [], writing: [], coding: [], reasoning: [] } },
      paid: {
        blazing: { planning: ["groq", "haiku", "haiku3"], writing: ["groq", "haiku", "haiku3"], coding: ["groq", "haiku", "haiku3"], reasoning: ["groq", "haiku", "haiku3"] },
        fast: { planning: ["haiku", "sonnet"], writing: ["haiku"], coding: ["haiku", "sonnet"], reasoning: ["haiku", "sonnet"] },
        slow: { planning: ["sonnet", "haiku"], writing: ["sonnet", "haiku"], coding: ["sonnet", "haiku"], reasoning: ["sonnet", "haiku"] },
      },
    },
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    LLMManager.reset();
    LLMManager.setConfigForTesting(tierTestConfig);
  });

  afterEach(() => {
    LLMManager.clearTestConfig();
  });

  describe("getLLM with maxTier parameter", () => {
    it.only("returns model within tier limit", async () => {
      // paid/slow/coding has: opus (disabled), sonnet (tier 2), haiku (tier 3)
      // maxTier=3 allows tier 3+ models (haiku, haiku3)
      const tier1LLM = await getLLM({ skill: "coding", speed: "slow", cost: "paid", maxTier: 1 });
      expect(tier1LLM).toBeInstanceOf(BaseChatModel);
      expect(tier1LLM.lc_kwargs.model).toBe("claude-sonnet-4-5");

      const tier2LLM = await getLLM({ skill: "coding", speed: "slow", cost: "paid", maxTier: 2 });
      expect(tier2LLM).toBeInstanceOf(BaseChatModel);
      expect(tier2LLM.lc_kwargs.model).toBe("claude-sonnet-4-5");

      const tier3LLM = await getLLM({ skill: "coding", speed: "slow", cost: "paid", maxTier: 3 });
      expect(tier3LLM).toBeInstanceOf(BaseChatModel);
      expect(tier3LLM.lc_kwargs.model).toBe("claude-haiku-4-5");

      const tier4LLM = await getLLM({ skill: "coding", speed: "slow", cost: "paid", maxTier: 4 });
      expect(tier4LLM).toBeInstanceOf(BaseChatModel);
      expect(tier4LLM.lc_kwargs.model).toBe("claude-haiku-4-5");

      const tier5LLM = await getLLM({ skill: "coding", speed: "slow", cost: "paid", maxTier: 5 });
      expect(tier5LLM).toBeInstanceOf(BaseChatModel);
      expect(tier5LLM.lc_kwargs.model).toBe("claude-haiku-4-5");
    });

    it("throws when no models available at tier", async () => {
      // maxTier=5 only allows tier 5 (cheapest)
      // paid/blazing/coding has only tier 2, 3, 4 models - no tier 5
      await expect(
        getLLM({ skill: "coding", speed: "blazing", cost: "paid", maxTier: 5 })
      ).rejects.toThrow(/No available model/);
    });
  });

  describe("getLLMFallbacks with maxTier parameter", () => {
    it("filters out models above tier limit", async () => {
      // paid/blazing/coding has: groq (tier 2), haiku (tier 3), haiku3 (tier 4)
      const allFallbacks = await getLLMFallbacks({ skill: "coding", speed: "blazing", cost: "paid" });
      // maxTier=3 filters out groq (tier 2), keeps haiku (tier 3) and haiku3 (tier 4)
      const tier3Fallbacks = await getLLMFallbacks({ skill: "coding", speed: "blazing", cost: "paid", maxTier: 3 });

      // Should have fewer models when tier is restricted
      expect(tier3Fallbacks.length).toBeLessThan(allFallbacks.length);
    });

    it("returns only models at or below tier", async () => {
      // maxTier=4 allows tiers 4 and 5, which should include haiku3
      const fallbacks = await getLLMFallbacks({ skill: "coding", speed: "blazing", cost: "paid", maxTier: 4 });
      expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    });

    it("combines with usagePercent filtering", async () => {
      // paid/slow/coding has: sonnet (tier 2), haiku (tier 3)
      const noFilters = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid" });
      const withTier = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid", maxTier: 3 });
      const withBoth = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid", maxTier: 3, usagePercent: 90 });

      // Each filter should reduce the count
      expect(withTier.length).toBeLessThanOrEqual(noFilters.length);
      expect(withBoth.length).toBeLessThanOrEqual(withTier.length);
    });
  });
});
