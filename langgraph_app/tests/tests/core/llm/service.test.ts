import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { db, eq } from "@db";
import { modelConfigs, modelPreferences } from "app/db/schema";
import { cache, LLMManager } from "@core";

const CACHE_KEY = "llm:model_configuration";

// Force sequential execution - these tests modify shared database tables
// @vitest-environment node

/**
 * Helper to create a timestamp for database records
 */
function now() {
  return new Date().toISOString();
}

/**
 * Helper to insert a model config into the database
 */
async function createModelConfig(data: {
  modelKey: string;
  enabled?: boolean;
  maxUsagePercent?: number | null;
  costIn?: string | null;
  costOut?: string | null;
  modelCard?: string | null;
}) {
  const timestamp = now();
  await db.insert(modelConfigs).values({
    modelKey: data.modelKey,
    enabled: data.enabled ?? true,
    maxUsagePercent: data.maxUsagePercent ?? 100,
    costIn: data.costIn ?? null,
    costOut: data.costOut ?? null,
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
 * Helper to update a model preference in the database
 */
async function updateModelPreference(
  costTier: string,
  speedTier: string,
  skill: string,
  modelKeys: string[]
) {
  await db
    .update(modelPreferences)
    .set({ modelKeys, updatedAt: now() })
    .where(eq(modelPreferences.costTier, costTier));
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

      // Fetch config - this calls the real Rails API
      const modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 0);

      // Should return sonnet (first in preference chain)
      expect(modelKey).toBe("sonnet");
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

      const modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 0);

      // Should skip disabled opus and return sonnet
      expect(modelKey).toBe("sonnet");
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
      let modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 0);
      expect(modelKey).toBe("sonnet");

      // Update database - change preference order
      await db
        .update(modelPreferences)
        .set({ modelKeys: ["haiku", "sonnet"], updatedAt: now() })
        .where(eq(modelPreferences.costTier, "paid"));

      // Without cache bust, should still return cached value
      modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 0);
      expect(modelKey).toBe("sonnet"); // Still cached

      // Bust cache
      await LLMManager.clearCache();

      // Now should see updated value
      modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 0);
      expect(modelKey).toBe("haiku"); // New order from DB
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
      const modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 40);
      expect(modelKey).toBe("opus"); // 40% < 50% threshold
    });

    it("falls back to next model when usage exceeds threshold", async () => {
      await setupTieredModels();
      const modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 51);
      expect(modelKey).toBe("sonnet"); // 51% > 50% threshold, falls back to sonnet
    });

    it("cascades through fallback chain as usage increases", async () => {
      await setupTieredModels();
      // At 0% - get opus (best model)
      expect(await LLMManager.getModelKey("coding", "slow", "paid", 0)).toBe("opus");

      // At 51% - opus excluded, get sonnet
      expect(await LLMManager.getModelKey("coding", "slow", "paid", 51)).toBe("sonnet");

      // At 81% - opus and sonnet excluded, get haiku
      expect(await LLMManager.getModelKey("coding", "slow", "paid", 81)).toBe("haiku");
    });

    it("model with 100% threshold is always available", async () => {
      await setupTieredModels();
      const modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 99);
      expect(modelKey).toBe("haiku"); // Only haiku available at 99%
    });

    it("throws error when usage exceeds all thresholds", async () => {
      await setupTieredModels();
      await expect(LLMManager.getModelKey("coding", "slow", "paid", 101)).rejects.toThrow(
        "No available model"
      );
    });

    it("getModelKeys returns all available models filtered by usage", async () => {
      await setupTieredModels();
      // At 0%, all models available
      expect(await LLMManager.getModelKeys("coding", "slow", "paid", 0)).toEqual([
        "opus",
        "sonnet",
        "haiku",
      ]);

      // At 51%, opus excluded
      expect(await LLMManager.getModelKeys("coding", "slow", "paid", 51)).toEqual([
        "sonnet",
        "haiku",
      ]);

      // At 81%, only haiku
      expect(await LLMManager.getModelKeys("coding", "slow", "paid", 81)).toEqual(["haiku"]);
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
      let modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 0);
      expect(modelKey).toBe("opus");

      // Step 4: Verify cache is populated
      let cached = await cache.get([CACHE_KEY]);
      expect(cached.length).toBe(1);

      // Step 5: Simulate user reaching 60% usage - should fall back
      modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 60);
      expect(modelKey).toBe("sonnet");

      // Step 6: Simulate user reaching 85% usage - should fall back again
      modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 85);
      expect(modelKey).toBe("haiku");

      // Step 7: Admin changes config in database (increase opus threshold)
      await updateModelConfig("opus", { maxUsagePercent: 70 });

      // Step 8: Without cache bust, still uses old cached config
      modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 60);
      expect(modelKey).toBe("sonnet"); // Still cached with old threshold

      // Step 9: Bust cache
      await LLMManager.clearCache();

      // Step 10: Now at 60% usage, opus should be available (threshold increased to 70%)
      modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 60);
      expect(modelKey).toBe("opus");
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
      const modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 99);
      expect(modelKey).toBe("haiku");
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
      let modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 50);
      expect(modelKey).toBe("sonnet");

      // At 50.001%, sonnet should be excluded
      modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 50.001);
      expect(modelKey).toBe("haiku");
    });

    it("handles empty preference chain", async () => {
      await createModelPreference({
        costTier: "paid",
        speedTier: "slow",
        skill: "coding",
        modelKeys: [], // Empty
      });

      await LLMManager.clearCache();

      await expect(LLMManager.getModelKey("coding", "slow", "paid", 0)).rejects.toThrow(
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
      const modelKey = await LLMManager.getModelKey("coding", "slow", "paid", 0);
      expect(modelKey).toBe("haiku");
    });
  });
});
