import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { db, eq } from "@db";
import { modelConfigs, modelPreferences } from "app/db/schema";
import { cache, LLMManager } from "@core";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

const CACHE_KEY = "llm:model_configuration";

// Force sequential execution - these tests modify shared database tables
// @vitest-environment node

/**
 * Helper to get model card (name) from a BaseChatModel instance
 */
function getModelCard(model: BaseChatModel): string {
  return (model as any).lc_kwargs?.model ?? (model as any).model ?? "";
}

/**
 * Helper to create a timestamp for database records
 */
function now() {
  return new Date().toISOString();
}

/**
 * Price tier thresholds (matches Rails model)
 * effective_cost = cost_in + (cost_out * 4)
 * Tier 1: $100+ (premium), Tier 2: $40-100, Tier 3: $15-40, Tier 4: $5-15, Tier 5: <$5
 */
const TIER_COSTS: Record<number, { costIn: string; costOut: string }> = {
  1: { costIn: "15.0", costOut: "75.0" },   // effective: 15 + (75 * 4) = 315
  2: { costIn: "3.0", costOut: "15.0" },    // effective: 3 + (15 * 4) = 63
  3: { costIn: "1.0", costOut: "5.0" },     // effective: 1 + (5 * 4) = 21
  4: { costIn: "0.5", costOut: "2.0" },     // effective: 0.5 + (2 * 4) = 8.5
  5: { costIn: "0.1", costOut: "0.5" },     // effective: 0.1 + (0.5 * 4) = 2.1
};

/**
 * Helper to insert a model config into the database
 * priceTier is computed from costIn/costOut, so we set costs based on desired tier
 */
async function createModelConfig(data: {
  modelKey: string;
  enabled?: boolean;
  maxUsagePercent?: number | null;
  costIn?: string | null;
  costOut?: string | null;
  modelCard?: string | null;
  priceTier?: number;
}) {
  const timestamp = now();
  // If priceTier is specified, use the corresponding costs (unless costIn/costOut are explicitly provided)
  const tierCosts = data.priceTier ? TIER_COSTS[data.priceTier] : undefined;
  await db.insert(modelConfigs).values({
    modelKey: data.modelKey,
    enabled: data.enabled ?? true,
    maxUsagePercent: data.maxUsagePercent ?? 100,
    costIn: data.costIn ?? tierCosts?.costIn ?? null,
    costOut: data.costOut ?? tierCosts?.costOut ?? null,
    modelCard: data.modelCard ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * Helper to update a model config in the database
 */
async function updateModelConfig(
  modelKey: string,
  data: Partial<{
    enabled: boolean;
    maxUsagePercent: number | null;
    costIn: string | null;
    costOut: string | null;
    modelCard: string | null;
  }>
) {
  await db
    .update(modelConfigs)
    .set({ ...data, updatedAt: now() })
    .where(eq(modelConfigs.modelKey, modelKey));
}

/**
 * Helper to insert a model preference into the database
 */
async function createModelPreference(data: {
  costTier: string;
  speedTier: string;
  skill: string;
  modelKeys: string[];
}) {
  const timestamp = now();
  await db.insert(modelPreferences).values({
    costTier: data.costTier,
    speedTier: data.speedTier,
    skill: data.skill,
    modelKeys: data.modelKeys,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * Clean up all test data
 */
async function cleanupTestData() {
  // Delete all model configs and preferences (test database)
  await db.delete(modelConfigs);
  await db.delete(modelPreferences);
  // Clear cache
  await cache.delete(CACHE_KEY);
}

// Force sequential execution because tests modify shared database tables
describe.sequential("LLMService Integration Tests", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
    LLMManager.reset();
  });

  afterEach(async () => {
    await cleanupTestData();
    LLMManager.reset();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("API Integration with Real Database", () => {
    it("fetches model configuration from Rails API based on database state", async () => {
      // Set up test data in database
      await createModelConfig({
        modelKey: "sonnet",
        enabled: true,
        maxUsagePercent: 90,
        modelCard: "claude-sonnet-4-5",
      });
      await createModelConfig({
        modelKey: "haiku",
        enabled: true,
        maxUsagePercent: 100,
        modelCard: "claude-haiku-4-5",
      });
      await createModelPreference({
        costTier: "paid",
        speedTier: "slow",
        skill: "coding",
        modelKeys: ["sonnet", "haiku"],
      });

      // Clear cache to force fresh fetch from API
      await LLMManager.clearCache();

      // Fetch model - this calls the real Rails API
      const model = await LLMManager.get("coding", "slow", "paid", 0);

      // Should return sonnet (first in preference chain)
      expect(model).toBeInstanceOf(BaseChatModel);
      expect(getModelCard(model)).toBe("claude-sonnet-4-5");
    });

    it("respects enabled flag from database", async () => {
      // Create models with first one disabled
      await createModelConfig({
        modelKey: "opus",
        enabled: false, // Disabled
        maxUsagePercent: 80,
        modelCard: "claude-opus-4-5",
      });
      await createModelConfig({
        modelKey: "sonnet",
        enabled: true,
        maxUsagePercent: 90,
        modelCard: "claude-sonnet-4-5",
      });
      await createModelPreference({
        costTier: "paid",
        speedTier: "slow",
        skill: "coding",
        modelKeys: ["opus", "sonnet"], // opus first but disabled
      });

      await LLMManager.clearCache();

      const model = await LLMManager.get("coding", "slow", "paid", 0);

      // Should skip disabled opus and return sonnet
      expect(getModelCard(model)).toBe("claude-sonnet-4-5");
    });
  });

  describe("Redis Cache Behavior", () => {
    it("caches configuration and requires cache bust to see updates", async () => {
      // Initial setup
      await createModelConfig({
        modelKey: "sonnet",
        enabled: true,
        maxUsagePercent: 90,
        modelCard: "claude-sonnet-4-5",
      });
      await createModelConfig({
        modelKey: "haiku",
        enabled: true,
        maxUsagePercent: 100,
        modelCard: "claude-haiku-4-5",
      });
      await createModelPreference({
        costTier: "paid",
        speedTier: "slow",
        skill: "coding",
        modelKeys: ["sonnet", "haiku"],
      });

      await LLMManager.clearCache();

      // First call - fetches from API and caches
      let model = await LLMManager.get("coding", "slow", "paid", 0);
      expect(getModelCard(model)).toBe("claude-sonnet-4-5");

      // Update database - change preference order
      await db
        .update(modelPreferences)
        .set({ modelKeys: ["haiku", "sonnet"], updatedAt: now() })
        .where(eq(modelPreferences.costTier, "paid"));

      // Without cache bust, should still return cached value
      model = await LLMManager.get("coding", "slow", "paid", 0);
      expect(getModelCard(model)).toBe("claude-sonnet-4-5"); // Still cached

      // Bust cache
      await LLMManager.clearCache();

      // Now should see updated value
      model = await LLMManager.get("coding", "slow", "paid", 0);
      expect(getModelCard(model)).toBe("claude-haiku-4-5"); // New order from DB
    });

    it("cache TTL expires and forces refetch", async () => {
      await createModelConfig({
        modelKey: "sonnet",
        enabled: true,
        maxUsagePercent: 90,
        modelCard: "claude-sonnet-4-5",
      });
      await createModelPreference({
        costTier: "paid",
        speedTier: "slow",
        skill: "coding",
        modelKeys: ["sonnet"],
      });

      // Manually set cache with short TTL
      const testConfig = {
        models: {
          sonnet: {
            enabled: true,
            maxUsagePercent: 90,
            costIn: null,
            costOut: null,
            modelCard: "claude-sonnet-4-5",
            priceTier: 2,
          },
        },
        preferences: {
          paid: {
            slow: {
              coding: ["sonnet"],
            },
          },
        },
        updatedAt: now(),
      };

      await cache.set([{ key: CACHE_KEY, value: testConfig, ttl: 1 }]);

      // Verify cache exists
      let cached = await cache.get([CACHE_KEY]);
      expect(cached.length).toBe(1);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Cache should be expired
      cached = await cache.get([CACHE_KEY]);
      expect(cached.length).toBe(0);
    });

    it("clearCache() removes cached configuration from Redis", async () => {
      // Manually set something in cache
      await cache.set([{ key: CACHE_KEY, value: { test: true } }]);

      // Verify it's there
      let cached = await cache.get([CACHE_KEY]);
      expect(cached.length).toBe(1);

      // Clear cache
      await LLMManager.clearCache();

      // Verify it's gone
      cached = await cache.get([CACHE_KEY]);
      expect(cached.length).toBe(0);
    });
  });

  describe("Usage-Based Fallbacks", () => {
    /**
     * Helper to set up tiered model configs for usage-based tests
     */
    async function setupTieredModels() {
      await createModelConfig({
        modelKey: "opus",
        enabled: true,
        maxUsagePercent: 50, // Only available below 50%
        modelCard: "claude-opus-4-5",
      });
      await createModelConfig({
        modelKey: "sonnet",
        enabled: true,
        maxUsagePercent: 80, // Only available below 80%
        modelCard: "claude-sonnet-4-5",
      });
      await createModelConfig({
        modelKey: "haiku",
        enabled: true,
        maxUsagePercent: 100, // Always available
        modelCard: "claude-haiku-4-5",
      });
      await createModelPreference({
        costTier: "paid",
        speedTier: "slow",
        skill: "coding",
        modelKeys: ["opus", "sonnet", "haiku"], // Fallback chain
      });
      await LLMManager.clearCache();
    }

    it("returns premium model when usage is below threshold", async () => {
      await setupTieredModels();
      const model = await LLMManager.get("coding", "slow", "paid", 40);
      expect(getModelCard(model)).toBe("claude-opus-4-5"); // 40% < 50% threshold
    });

    it("falls back to next model when usage exceeds threshold", async () => {
      await setupTieredModels();
      const model = await LLMManager.get("coding", "slow", "paid", 51);
      expect(getModelCard(model)).toBe("claude-sonnet-4-5"); // 51% > 50% threshold, falls back to sonnet
    });

    it("cascades through fallback chain as usage increases", async () => {
      await setupTieredModels();
      // At 0% - get opus (best model)
      expect(getModelCard(await LLMManager.get("coding", "slow", "paid", 0))).toBe("claude-opus-4-5");

      // At 51% - opus excluded, get sonnet
      expect(getModelCard(await LLMManager.get("coding", "slow", "paid", 51))).toBe("claude-sonnet-4-5");

      // At 81% - opus and sonnet excluded, get haiku
      expect(getModelCard(await LLMManager.get("coding", "slow", "paid", 81))).toBe("claude-haiku-4-5");
    });

    it("model with 100% threshold is always available", async () => {
      await setupTieredModels();
      const model = await LLMManager.get("coding", "slow", "paid", 99);
      expect(getModelCard(model)).toBe("claude-haiku-4-5"); // Only haiku available at 99%
    });

    it("throws error when usage exceeds all thresholds", async () => {
      await setupTieredModels();
      await expect(LLMManager.get("coding", "slow", "paid", 101)).rejects.toThrow(
        "No available model"
      );
    });

    it("getFallbacks returns all available models filtered by usage", async () => {
      await setupTieredModels();
      // At 0%, all models available
      let fallbacks = await LLMManager.getFallbacks("coding", "slow", "paid", 0);
      expect(fallbacks.map(getModelCard)).toEqual([
        "claude-opus-4-5",
        "claude-sonnet-4-5",
        "claude-haiku-4-5",
      ]);

      // At 51%, opus excluded
      fallbacks = await LLMManager.getFallbacks("coding", "slow", "paid", 51);
      expect(fallbacks.map(getModelCard)).toEqual([
        "claude-sonnet-4-5",
        "claude-haiku-4-5",
      ]);

      // At 81%, only haiku
      fallbacks = await LLMManager.getFallbacks("coding", "slow", "paid", 81);
      expect(fallbacks.map(getModelCard)).toEqual(["claude-haiku-4-5"]);
    });
  });

  describe("Full Integration: Database -> Cache -> Model Selection -> Fallback", () => {
    it("complete flow with real API and cache", async () => {
      // Step 1: Set up initial database state (using standard model keys that have providers)
      await createModelConfig({
        modelKey: "opus",
        enabled: true,
        maxUsagePercent: 50,
        modelCard: "claude-opus-4-5",
      });
      await createModelConfig({
        modelKey: "sonnet",
        enabled: true,
        maxUsagePercent: 80,
        modelCard: "claude-sonnet-4-5",
      });
      await createModelConfig({
        modelKey: "haiku",
        enabled: true,
        maxUsagePercent: 100,
        modelCard: "claude-haiku-4-5",
      });
      await createModelPreference({
        costTier: "paid",
        speedTier: "slow",
        skill: "coding",
        modelKeys: ["opus", "sonnet", "haiku"],
      });

      // Step 2: Clear cache
      await LLMManager.clearCache();

      // Step 3: Verify model selection at 0% usage
      let model = await LLMManager.get("coding", "slow", "paid", 0);
      expect(getModelCard(model)).toBe("claude-opus-4-5");

      // Step 4: Verify cache is populated
      let cached = await cache.get([CACHE_KEY]);
      expect(cached.length).toBe(1);

      // Step 5: Simulate user reaching 60% usage - should fall back
      model = await LLMManager.get("coding", "slow", "paid", 60);
      expect(getModelCard(model)).toBe("claude-sonnet-4-5");

      // Step 6: Simulate user reaching 85% usage - should fall back again
      model = await LLMManager.get("coding", "slow", "paid", 85);
      expect(getModelCard(model)).toBe("claude-haiku-4-5");

      // Step 7: Admin changes config in database (increase opus threshold)
      await updateModelConfig("opus", { maxUsagePercent: 70 });

      // Step 8: Without cache bust, still uses old cached config
      model = await LLMManager.get("coding", "slow", "paid", 60);
      expect(getModelCard(model)).toBe("claude-sonnet-4-5"); // Still cached with old threshold

      // Step 9: Bust cache
      await LLMManager.clearCache();

      // Step 10: Now at 60% usage, opus should be available (threshold increased to 70%)
      model = await LLMManager.get("coding", "slow", "paid", 60);
      expect(getModelCard(model)).toBe("claude-opus-4-5");
    });
  });

  describe("Price Tier Filtering (maxTier)", () => {
    /**
     * Helper to set up models with different price tiers for maxTier tests
     * Tier 1 = premium (opus), Tier 2 = high-end (sonnet), Tier 3 = mid (haiku)
     */
    async function setupTieredPriceModels() {
      await createModelConfig({
        modelKey: "opus",
        enabled: true,
        maxUsagePercent: 100,
        costIn: "15.0",
        costOut: "75.0",
        modelCard: "claude-opus-4-5",
        priceTier: 1,
      });
      await createModelConfig({
        modelKey: "sonnet",
        enabled: true,
        maxUsagePercent: 100,
        costIn: "3.0",
        costOut: "15.0",
        modelCard: "claude-sonnet-4-5",
        priceTier: 2,
      });
      await createModelConfig({
        modelKey: "haiku",
        enabled: true,
        maxUsagePercent: 100,
        costIn: "1.0",
        costOut: "5.0",
        modelCard: "claude-haiku-4-5",
        priceTier: 3,
      });
      await createModelPreference({
        costTier: "paid",
        speedTier: "slow",
        skill: "coding",
        modelKeys: ["opus", "sonnet", "haiku"], // Preference order
      });
      await LLMManager.clearCache();
    }

    it("returns all models when maxTier is not specified", async () => {
      await setupTieredPriceModels();

      const fallbacks = await LLMManager.getFallbacks("coding", "slow", "paid", 0);
      expect(fallbacks.map(getModelCard)).toEqual(["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"]);
    });

    it("filters out premium models when maxTier=2", async () => {
      await setupTieredPriceModels();

      // maxTier=2 means only tier 2+ (high-end and cheaper) are allowed
      const fallbacks = await LLMManager.getFallbacks("coding", "slow", "paid", 0, 2);
      expect(fallbacks.map(getModelCard)).toEqual(["claude-sonnet-4-5", "claude-haiku-4-5"]); // opus (tier 1) filtered out
    });

    it("filters to only mid-tier and cheaper when maxTier=3", async () => {
      await setupTieredPriceModels();

      // maxTier=3 means only tier 3+ (mid-tier and cheaper) are allowed
      const fallbacks = await LLMManager.getFallbacks("coding", "slow", "paid", 0, 3);
      expect(fallbacks.map(getModelCard)).toEqual(["claude-haiku-4-5"]); // opus (tier 1) and sonnet (tier 2) filtered out
    });

    it("get() returns first available model within tier constraint", async () => {
      await setupTieredPriceModels();

      // Without maxTier, returns opus (first in preference)
      expect(getModelCard(await LLMManager.get("coding", "slow", "paid", 0))).toBe("claude-opus-4-5");

      // With maxTier=2, skips opus and returns sonnet
      expect(getModelCard(await LLMManager.get("coding", "slow", "paid", 0, 2))).toBe("claude-sonnet-4-5");

      // With maxTier=3, skips opus and sonnet, returns haiku
      expect(getModelCard(await LLMManager.get("coding", "slow", "paid", 0, 3))).toBe("claude-haiku-4-5");
    });

    it("throws error when no models match the tier constraint", async () => {
      await setupTieredPriceModels();

      // maxTier=4 means only tier 4+ allowed, but our cheapest is tier 3
      await expect(LLMManager.get("coding", "slow", "paid", 0, 4)).rejects.toThrow(
        "No available model"
      );
    });

    it("combines maxTier with usage-based filtering", async () => {
      // Set up models with both tier and usage constraints
      await createModelConfig({
        modelKey: "opus",
        enabled: true,
        maxUsagePercent: 50, // Only available below 50%
        costIn: "15.0",
        costOut: "75.0",
        modelCard: "claude-opus-4-5",
        priceTier: 1,
      });
      await createModelConfig({
        modelKey: "sonnet",
        enabled: true,
        maxUsagePercent: 80, // Only available below 80%
        costIn: "3.0",
        costOut: "15.0",
        modelCard: "claude-sonnet-4-5",
        priceTier: 2,
      });
      await createModelConfig({
        modelKey: "haiku",
        enabled: true,
        maxUsagePercent: 100, // Always available
        costIn: "1.0",
        costOut: "5.0",
        modelCard: "claude-haiku-4-5",
        priceTier: 3,
      });
      await createModelPreference({
        costTier: "paid",
        speedTier: "slow",
        skill: "coding",
        modelKeys: ["opus", "sonnet", "haiku"],
      });
      await LLMManager.clearCache();

      // At 0% usage with maxTier=2: opus excluded by tier, sonnet and haiku available
      expect(getModelCard(await LLMManager.get("coding", "slow", "paid", 0, 2))).toBe("claude-sonnet-4-5");

      // At 60% usage with maxTier=2: opus excluded by tier AND usage, sonnet available
      expect(getModelCard(await LLMManager.get("coding", "slow", "paid", 60, 2))).toBe("claude-sonnet-4-5");

      // At 85% usage with maxTier=2: opus excluded by tier, sonnet excluded by usage, haiku available
      expect(getModelCard(await LLMManager.get("coding", "slow", "paid", 85, 2))).toBe("claude-haiku-4-5");
    });

    it("includes error message with maxTier when no models available", async () => {
      await setupTieredPriceModels();

      await expect(LLMManager.get("coding", "slow", "paid", 0, 5)).rejects.toThrow(
        "maxTier=5"
      );
    });
  });

  describe("Edge Cases", () => {
    it("handles null maxUsagePercent as 100%", async () => {
      // Using haiku which has a known provider mapping
      await createModelConfig({
        modelKey: "haiku",
        enabled: true,
        maxUsagePercent: null, // null = always available
        modelCard: "claude-haiku-4-5",
      });
      await createModelPreference({
        costTier: "paid",
        speedTier: "slow",
        skill: "coding",
        modelKeys: ["haiku"],
      });

      await LLMManager.clearCache();

      // Should be available even at 99%
      const model = await LLMManager.get("coding", "slow", "paid", 99);
      expect(getModelCard(model)).toBe("claude-haiku-4-5");
    });

    it("handles boundary values correctly (usage == threshold)", async () => {
      // Using sonnet for 50% threshold and haiku for 100%
      await createModelConfig({
        modelKey: "sonnet",
        enabled: true,
        maxUsagePercent: 50,
        modelCard: "claude-sonnet-4-5",
      });
      await createModelConfig({
        modelKey: "haiku",
        enabled: true,
        maxUsagePercent: 100,
        modelCard: "claude-haiku-4-5",
      });
      await createModelPreference({
        costTier: "paid",
        speedTier: "slow",
        skill: "coding",
        modelKeys: ["sonnet", "haiku"],
      });

      await LLMManager.clearCache();

      // At exactly 50%, sonnet should still be available (not > 50)
      let model = await LLMManager.get("coding", "slow", "paid", 50);
      expect(getModelCard(model)).toBe("claude-sonnet-4-5");

      // At 50.001%, sonnet should be excluded
      model = await LLMManager.get("coding", "slow", "paid", 50.001);
      expect(getModelCard(model)).toBe("claude-haiku-4-5");
    });

    it("handles empty preference chain", async () => {
      await createModelPreference({
        costTier: "paid",
        speedTier: "slow",
        skill: "coding",
        modelKeys: [], // Empty
      });

      await LLMManager.clearCache();

      await expect(LLMManager.get("coding", "slow", "paid", 0)).rejects.toThrow(
        "No available model"
      );
    });

    it("handles unknown model in preferences gracefully", async () => {
      // Using haiku which has a known provider mapping
      await createModelConfig({
        modelKey: "haiku",
        enabled: true,
        maxUsagePercent: 100,
        modelCard: "claude-haiku-4-5",
      });
      await createModelPreference({
        costTier: "paid",
        speedTier: "slow",
        skill: "coding",
        modelKeys: ["nonexistent_model", "haiku"], // First doesn't exist
      });

      await LLMManager.clearCache();

      // Should skip unknown model and return haiku
      const model = await LLMManager.get("coding", "slow", "paid", 0);
      expect(getModelCard(model)).toBe("claude-haiku-4-5");
    });
  });
});
