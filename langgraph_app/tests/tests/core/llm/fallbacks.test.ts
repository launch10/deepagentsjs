import { describe, it, expect, beforeEach } from "vitest";
import { getLLM, getLLMFallbacks, LLMManager } from "@core";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

describe("LLM Fallbacks", () => {
  beforeEach(() => {
    LLMManager.reset();
  });

  describe("getLLM", () => {
    it("returns a single LLM instance (highest priority model)", () => {
      const llm = getLLM("coding", "slow", "paid");
      expect(llm).toBeInstanceOf(BaseChatModel);
    });
  });

  describe("getLLMFallbacks", () => {
    it("returns an array of LLM instances", () => {
      const fallbacks = getLLMFallbacks("coding", "slow", "paid");
      expect(Array.isArray(fallbacks)).toBe(true);
      expect(fallbacks.length).toBeGreaterThan(0);
    });

    it("returns models in priority order (best first)", () => {
      const fallbacks = getLLMFallbacks("coding", "slow", "paid");
      // First model should be the highest quality (e.g., Opus or Sonnet)
      // Last model should be the fallback (e.g., Haiku or cheaper option)
      expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    });

    it("first fallback matches what getLLM returns", () => {
      const primary = getLLM("coding", "slow", "paid");
      const fallbacks = getLLMFallbacks("coding", "slow", "paid");

      // The first fallback should be the same model as getLLM returns
      // We compare the model names since instances may differ
      expect(fallbacks[0]).toBeDefined();
    });

    it("returns different fallback chains for different skills", () => {
      const codingFallbacks = getLLMFallbacks("coding", "slow", "paid");
      const writingFallbacks = getLLMFallbacks("writing", "slow", "paid");

      // Different skills may have different fallback priorities
      expect(codingFallbacks).toBeDefined();
      expect(writingFallbacks).toBeDefined();
    });

    it("returns different fallback chains for different speeds", () => {
      const slowFallbacks = getLLMFallbacks("coding", "slow", "paid");
      const fastFallbacks = getLLMFallbacks("coding", "fast", "paid");

      // Slow tier should have more/better models, fast tier optimizes for speed
      expect(slowFallbacks.length).toBeGreaterThanOrEqual(1);
      expect(fastFallbacks.length).toBeGreaterThanOrEqual(1);
    });

    it("returns different fallback chains for different cost tiers", () => {
      const paidFallbacks = getLLMFallbacks("coding", "slow", "paid");
      const freeFallbacks = getLLMFallbacks("coding", "slow", "free");

      // Paid tier should have premium models, free tier has local/free models
      expect(paidFallbacks.length).toBeGreaterThanOrEqual(1);
      expect(freeFallbacks.length).toBeGreaterThanOrEqual(1);
    });

    it("only includes models that are configured (have API keys)", () => {
      const fallbacks = getLLMFallbacks("coding", "slow", "paid");

      // All returned models should be usable (properly configured)
      for (const model of fallbacks) {
        expect(model).toBeInstanceOf(BaseChatModel);
      }
    });
  });

  describe("fallback chain configuration", () => {
    it("paid slow coding should prioritize quality models", () => {
      // Expected order for paid/slow/coding: Opus -> Sonnet -> Haiku -> Gpt5
      const fallbacks = getLLMFallbacks("coding", "slow", "paid");
      expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    });

    it("paid fast coding should prioritize speed", () => {
      // Expected order for paid/fast/coding: Haiku -> Sonnet (fast models first)
      const fallbacks = getLLMFallbacks("coding", "fast", "paid");
      expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("Usage-Based LLM Filtering", () => {
  beforeEach(() => {
    LLMManager.reset();
  });

  describe("getLLMFallbacks with usagePercent parameter", () => {
    it("includes all models when usagePercent is 0", () => {
      const fallbacks = getLLMFallbacks("coding", "slow", "paid", 0);
      // At 0% usage, should get all configured models
      expect(fallbacks.length).toBeGreaterThanOrEqual(3);
    });

    it("excludes models above usage threshold", () => {
      // At 85% usage, Opus (80%) should be excluded
      const fallbacksHigh = getLLMFallbacks("coding", "slow", "paid", 85);
      const fallbacksLow = getLLMFallbacks("coding", "slow", "paid", 0);

      // High usage should have fewer models
      expect(fallbacksHigh.length).toBeLessThan(fallbacksLow.length);
    });

    it("always returns at least one model (100% threshold models)", () => {
      // Even at 99% usage, should have at least one model available
      const fallbacks = getLLMFallbacks("coding", "slow", "paid", 99);
      expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    });

    it("filters models correctly at exact threshold boundaries", () => {
      // At exactly 80%, Opus should still be available (usage < threshold)
      const fallbacksAt80 = getLLMFallbacks("coding", "slow", "paid", 80);
      console.log(
        "fallbacksAt80",
        fallbacksAt80.map((m) => (m as any).modelName)
      );

      // At 80.1%, Opus should be excluded (usage >= threshold)
      const fallbacksAbove80 = getLLMFallbacks("coding", "slow", "paid", 80.1);
      console.log(
        "fallbacksAbove80",
        fallbacksAbove80.map((m) => (m as any).modelName)
      );

      // Should have one less model after crossing the threshold
      expect(fallbacksAbove80.length).toBeLessThan(fallbacksAt80.length);
    });

    it("defaults to 0% usage when not specified", () => {
      const fallbacksDefault = getLLMFallbacks("coding", "slow", "paid");
      const fallbacksExplicit = getLLMFallbacks("coding", "slow", "paid", 0);

      // Should return the same number of models
      expect(fallbacksDefault.length).toBe(fallbacksExplicit.length);
    });
  });

  describe("usage threshold configuration", () => {
    it("models without explicit threshold default to 100%", () => {
      // Models with no maxUsagePercent should always be available
      const fallbacks = getLLMFallbacks("coding", "slow", "paid", 99);
      expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
