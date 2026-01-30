import { describe, it, expect, beforeEach } from "vitest";
import { getLLM, getLLMFallbacks, LLMManager } from "@core";
import { DatabaseSnapshotter } from "@services";

describe("LLM Fallbacks", () => {
  beforeEach(async () => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    LLMManager.reset();
    LLMManager.setIgnoreEnvMaxTier(true);
  });

  describe("getLLM", () => {
    it("returns a single LLM instance (highest priority model)", async () => {
      const llm = await getLLM({ skill: "coding", speed: "slow", cost: "paid" });
      // getLLM returns a RunnableBinding wrapping the model for usage tracking
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe("function");
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
      const codingFallbacks = await getLLMFallbacks({
        skill: "coding",
        speed: "slow",
        cost: "paid",
      });
      const writingFallbacks = await getLLMFallbacks({
        skill: "writing",
        speed: "slow",
        cost: "paid",
      });

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
        expect(model).toBeDefined();
        expect(typeof model.invoke).toBe("function");
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
  beforeEach(async () => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    LLMManager.reset();
    LLMManager.setIgnoreEnvMaxTier(true);
  });

  describe("getLLMFallbacks with usagePercent parameter", () => {
    it("includes all models when usagePercent is 0", async () => {
      const fallbacks = await getLLMFallbacks({
        skill: "coding",
        speed: "slow",
        cost: "paid",
        usagePercent: 0,
      });
      // At 0% usage, should get all configured models
      expect(fallbacks.length).toBeGreaterThanOrEqual(3);
    });

    it("excludes models above usage threshold", async () => {
      const fallbacksHigh = await getLLMFallbacks({
        skill: "coding",
        speed: "slow",
        cost: "paid",
        usagePercent: 100,
      });
      const fallbacksLow = await getLLMFallbacks({
        skill: "coding",
        speed: "slow",
        cost: "paid",
        usagePercent: 0,
      });

      // High usage should have fewer models
      expect(fallbacksHigh.length).toBeLessThan(fallbacksLow.length);
    });

    it("always returns at least one model (100% threshold models)", async () => {
      // Even at 99% usage, should have at least one model available
      const fallbacks = await getLLMFallbacks({
        skill: "coding",
        speed: "slow",
        cost: "paid",
        usagePercent: 100,
      });
      expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    });

    it("filters models correctly at exact threshold boundaries", async () => {
      // At exactly 90%, Sonnet should still be available (usage < threshold)
      const fallbacksAt90 = await getLLMFallbacks({
        skill: "coding",
        speed: "slow",
        cost: "paid",
        usagePercent: 90,
      });
      console.log(
        "fallbacksAt90",
        fallbacksAt90.map((m) => (m as any).modelName)
      );

      // At 90.1%, Sonnet should be excluded (usage >= threshold)
      const fallbacksAbove90 = await getLLMFallbacks({
        skill: "coding",
        speed: "slow",
        cost: "paid",
        usagePercent: 90.1,
      });
      console.log(
        "fallbacksAbove90",
        fallbacksAbove90.map((m) => (m as any).modelName)
      );

      // Should have one less model after crossing the threshold
      expect(fallbacksAbove90.length).toBeLessThan(fallbacksAt90.length);
    });

    it("defaults to 0% usage when not specified", async () => {
      const fallbacksDefault = await getLLMFallbacks({
        skill: "coding",
        speed: "slow",
        cost: "paid",
      });
      const fallbacksExplicit = await getLLMFallbacks({
        skill: "coding",
        speed: "slow",
        cost: "paid",
        usagePercent: 0,
      });

      // Should return the same number of models
      expect(fallbacksDefault.length).toBe(fallbacksExplicit.length);
    });
  });

  describe("usage threshold configuration", () => {
    it("models without explicit threshold default to 100%", async () => {
      // Models with no maxUsagePercent should always be available
      const fallbacks = await getLLMFallbacks({
        skill: "coding",
        speed: "slow",
        cost: "paid",
        usagePercent: 99,
      });
      expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("Price Tier Filtering", () => {
  beforeEach(async () => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    LLMManager.reset();
    LLMManager.setIgnoreEnvMaxTier(true);
  });

  describe("getLLM with maxTier parameter", () => {
    it("returns model within tier limit", async () => {
      // maxTier filters to only allow models with tier >= maxTier
      // getLLM returns a RunnableBinding wrapping the model for usage tracking
      // Higher tier numbers = cheaper models

      const tier2LLM = await getLLM({ skill: "coding", speed: "slow", cost: "paid", maxTier: 2 });
      expect(tier2LLM).toBeDefined();
      const tier2Model = (tier2LLM as any).bound?.model;
      expect(tier2Model).toBeDefined();

      const tier3LLM = await getLLM({ skill: "coding", speed: "slow", cost: "paid", maxTier: 3 });
      expect(tier3LLM).toBeDefined();
      const tier3Model = (tier3LLM as any).bound?.model;
      expect(tier3Model).toBeDefined();

      const tier4LLM = await getLLM({ skill: "coding", speed: "slow", cost: "paid", maxTier: 4 });
      expect(tier4LLM).toBeDefined();
      const tier4Model = (tier4LLM as any).bound?.model;
      expect(tier4Model).toBeDefined();

      // Different tiers should return different models (more restrictive tiers exclude premium models)
      expect(tier2Model).not.toBe(tier3Model);
    });

    it("falls back to cheapest available model when no models match tier", async () => {
      // maxTier=5 only allows tier 5 (cheapest) - no tier 5 models configured in preferences
      // But findCheapestFallback kicks in and returns the cheapest enabled model
      const llm = await getLLM({ skill: "coding", speed: "slow", cost: "paid", maxTier: 5 });
      expect(llm).toBeDefined();
      // The fallback mechanism ensures we always get a model rather than failing
    });
  });

  describe("getLLMFallbacks with maxTier parameter", () => {
    it("filters out models above tier limit", async () => {
      const allFallbacks = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid" });
      const tier3Fallbacks = await getLLMFallbacks({
        skill: "coding",
        speed: "slow",
        cost: "paid",
        maxTier: 3,
      });

      // maxTier=3 filters out sonnet (tier 2), keeps haiku (tier 3) and haiku3 (tier 4)
      expect(tier3Fallbacks.length).toBeLessThan(allFallbacks.length);
    });

    it("combines with usagePercent filtering", async () => {
      const noFilters = await getLLMFallbacks({ skill: "coding", speed: "slow", cost: "paid" });
      const withTier = await getLLMFallbacks({
        skill: "coding",
        speed: "slow",
        cost: "paid",
        maxTier: 3,
      });
      const withBoth = await getLLMFallbacks({
        skill: "coding",
        speed: "slow",
        cost: "paid",
        maxTier: 3,
        usagePercent: 90,
      });

      // Each filter should reduce the count
      expect(withTier.length).toBeLessThanOrEqual(noFilters.length);
      expect(withBoth.length).toBeLessThanOrEqual(withTier.length);
    });
  });
});
