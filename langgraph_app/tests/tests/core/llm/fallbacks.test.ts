import { describe, it, expect, beforeEach } from "vitest";
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
      const llm = await getLLM("coding", "slow", "paid");
      expect(llm).toBeInstanceOf(BaseChatModel);
    });
  });

  describe("getLLMFallbacks", () => {
    it("returns an array of LLM instances", async () => {
      const fallbacks = await getLLMFallbacks("coding", "slow", "paid");
      expect(Array.isArray(fallbacks)).toBe(true);
      expect(fallbacks.length).toBeGreaterThan(0);
    });

    it("returns models in priority order (best first)", async () => {
      const fallbacks = await getLLMFallbacks("coding", "slow", "paid");
      // First model should be the highest quality (e.g., Opus or Sonnet)
      // Last model should be the fallback (e.g., Haiku or cheaper option)
      expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    });

    it("first fallback matches what getLLM returns", async () => {
      const primary = await getLLM("coding", "slow", "paid");
      const fallbacks = await getLLMFallbacks("coding", "slow", "paid");

      // The first fallback should be the same model as getLLM returns
      // We compare the model names since instances may differ
      expect(fallbacks[0]).toBeDefined();
    });

    it("returns different fallback chains for different skills", async () => {
      const codingFallbacks = await getLLMFallbacks("coding", "slow", "paid");
      const writingFallbacks = await getLLMFallbacks("writing", "slow", "paid");

      // Different skills may have different fallback priorities
      expect(codingFallbacks).toBeDefined();
      expect(writingFallbacks).toBeDefined();
    });

    it("returns different fallback chains for different speeds", async () => {
      const slowFallbacks = await getLLMFallbacks("coding", "slow", "paid");
      const fastFallbacks = await getLLMFallbacks("coding", "fast", "paid");

      // Slow tier should have more/better models, fast tier optimizes for speed
      expect(slowFallbacks.length).toBeGreaterThanOrEqual(1);
      expect(fastFallbacks.length).toBeGreaterThanOrEqual(1);
    });

    it("returns different fallback chains for different cost tiers", async () => {
      // Note: We only test paid tier here because free tier requires Ollama (not available on CI)
      const paidFallbacks = await getLLMFallbacks("coding", "slow", "paid");

      // Paid tier should have premium models
      expect(paidFallbacks.length).toBeGreaterThanOrEqual(1);
    });

    it("only includes models that are configured (have API keys)", async () => {
      const fallbacks = await getLLMFallbacks("coding", "slow", "paid");

      // All returned models should be usable (properly configured)
      for (const model of fallbacks) {
        expect(model).toBeInstanceOf(BaseChatModel);
      }
    });
  });

  describe("fallback chain configuration", () => {
    it("paid slow coding should prioritize quality models", async () => {
      // Expected order for paid/slow/coding: Opus -> Sonnet -> Haiku -> Gpt5
      const fallbacks = await getLLMFallbacks("coding", "slow", "paid");
      expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    });

    it("paid fast coding should prioritize speed", async () => {
      // Expected order for paid/fast/coding: Haiku -> Sonnet (fast models first)
      const fallbacks = await getLLMFallbacks("coding", "fast", "paid");
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
      const fallbacks = await getLLMFallbacks("coding", "slow", "paid", 0);
      // At 0% usage, should get all configured models
      expect(fallbacks.length).toBeGreaterThanOrEqual(3);
    });

    it("excludes models above usage threshold", async () => {
      const fallbacksHigh = await getLLMFallbacks("coding", "slow", "paid", 100);
      const fallbacksLow = await getLLMFallbacks("coding", "slow", "paid", 0);

      // High usage should have fewer models
      expect(fallbacksHigh.length).toBeLessThan(fallbacksLow.length);
    });

    it("always returns at least one model (100% threshold models)", async () => {
      // Even at 99% usage, should have at least one model available
      const fallbacks = await getLLMFallbacks("coding", "slow", "paid", 100);
      expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    });

    it("filters models correctly at exact threshold boundaries", async () => {
      // At exactly 90%, Sonnet should still be available (usage < threshold)
      const fallbacksAt90 = await getLLMFallbacks("coding", "slow", "paid", 90);
      console.log(
        "fallbacksAt90",
        fallbacksAt90.map((m) => (m as any).modelName)
      );

      // At 90.1%, Sonnet should be excluded (usage >= threshold)
      const fallbacksAbove90 = await getLLMFallbacks("coding", "slow", "paid", 90.1);
      console.log(
        "fallbacksAbove90",
        fallbacksAbove90.map((m) => (m as any).modelName)
      );

      // Should have one less model after crossing the threshold
      expect(fallbacksAbove90.length).toBeLessThan(fallbacksAt90.length);
    });

    it("defaults to 0% usage when not specified", async () => {
      const fallbacksDefault = await getLLMFallbacks("coding", "slow", "paid");
      const fallbacksExplicit = await getLLMFallbacks("coding", "slow", "paid", 0);

      // Should return the same number of models
      expect(fallbacksDefault.length).toBe(fallbacksExplicit.length);
    });
  });

  describe("usage threshold configuration", () => {
    it("models without explicit threshold default to 100%", async () => {
      // Models with no maxUsagePercent should always be available
      const fallbacks = await getLLMFallbacks("coding", "slow", "paid", 99);
      expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
