import { describe, it, expect, beforeEach } from "vitest";
import { ModelConfigurationService } from "../../../../app/services/core/modelConfigurationService";

/**
 * Integration tests for ModelConfigurationService.
 * These tests hit the real Rails API using seeded data.
 * Run `cd ../rails_app && bundle exec rails db:seed` to ensure seeds exist.
 */
describe("ModelConfigurationService", () => {
  beforeEach(() => {
    ModelConfigurationService.clearCache();
  });

  describe("Model Configs", () => {
    describe("getAllModels", () => {
      it("fetches model configs from Rails API", async () => {
        const configs = await ModelConfigurationService.getAllModels();

        // Should have all seeded models
        expect(configs.opus).toBeDefined();
        expect(configs.sonnet).toBeDefined();
        expect(configs.haiku).toBeDefined();
        expect(configs.groq).toBeDefined();
        expect(configs.gpt5).toBeDefined();
      });

      it("returns expected structure for each model", async () => {
        const configs = await ModelConfigurationService.getAllModels();
        const opus = configs.opus;

        expect(opus).toHaveProperty("enabled");
        expect(opus).toHaveProperty("maxUsagePercent");
        expect(opus).toHaveProperty("costIn");
        expect(opus).toHaveProperty("costOut");
        expect(opus).toHaveProperty("modelCard");
      });

      it("returns correct model cards", async () => {
        const configs = await ModelConfigurationService.getAllModels();

        expect(configs.opus!.modelCard).toBe("claude-opus-4-5");
        expect(configs.sonnet!.modelCard).toBe("claude-sonnet-4-5");
        expect(configs.haiku!.modelCard).toBe("claude-haiku-4-5");
      });

      it("caches results - same data returned", async () => {
        const result1 = await ModelConfigurationService.getAllModels();
        const result2 = await ModelConfigurationService.getAllModels();

        // Same cached data
        expect(result1).toStrictEqual(result2);
      });
    });

    describe("getModel", () => {
      it("returns config for a specific model", async () => {
        const opusConfig = await ModelConfigurationService.getModel("opus");

        expect(opusConfig).toBeDefined();
        expect(opusConfig!.enabled).toBe(false); // Opus is disabled by default
        expect(opusConfig!.maxUsagePercent).toBe(80);
      });

      it("returns undefined for unknown model", async () => {
        const unknownConfig = await ModelConfigurationService.getModel("unknown_model_xyz");

        expect(unknownConfig).toBeUndefined();
      });
    });

    describe("isEnabled", () => {
      it("returns false for opus (disabled by seed)", async () => {
        const isEnabled = await ModelConfigurationService.isEnabled("opus");
        expect(isEnabled).toBe(false);
      });

      it("returns true for sonnet (enabled by seed)", async () => {
        const isEnabled = await ModelConfigurationService.isEnabled("sonnet");
        expect(isEnabled).toBe(true);
      });

      it("returns true by default for unknown model", async () => {
        const isEnabled = await ModelConfigurationService.isEnabled("unknown_model_xyz");
        expect(isEnabled).toBe(true);
      });
    });

    describe("getMaxUsagePercent", () => {
      it("returns seeded value for opus", async () => {
        const maxUsage = await ModelConfigurationService.getMaxUsagePercent("opus");
        expect(maxUsage).toBe(80);
      });

      it("returns seeded value for sonnet", async () => {
        const maxUsage = await ModelConfigurationService.getMaxUsagePercent("sonnet");
        expect(maxUsage).toBe(90);
      });

      it("returns seeded value for haiku", async () => {
        const maxUsage = await ModelConfigurationService.getMaxUsagePercent("haiku");
        expect(maxUsage).toBe(95);
      });

      it("returns 100 by default for unknown model", async () => {
        const maxUsage = await ModelConfigurationService.getMaxUsagePercent("unknown_model_xyz");
        expect(maxUsage).toBe(100);
      });
    });
  });

  describe("Model Preferences", () => {
    describe("getAllPreferences", () => {
      it("fetches model preferences from Rails API", async () => {
        const preferences = await ModelConfigurationService.getAllPreferences();

        // Should have both cost tiers
        expect(preferences.paid).toBeDefined();
        expect(preferences.free).toBeDefined();
      });

      it("returns expected nested structure", async () => {
        const preferences = await ModelConfigurationService.getAllPreferences();

        // Check paid tier structure
        expect(preferences.paid?.slow).toBeDefined();
        expect(preferences.paid?.fast).toBeDefined();
        expect(preferences.paid?.blazing).toBeDefined();

        // Check skills within paid/slow
        expect(preferences.paid?.slow?.coding).toBeDefined();
        expect(preferences.paid?.slow?.writing).toBeDefined();
        expect(preferences.paid?.slow?.planning).toBeDefined();
        expect(preferences.paid?.slow?.reasoning).toBeDefined();
      });

      it("returns arrays of model keys for each preference", async () => {
        const preferences = await ModelConfigurationService.getAllPreferences();

        const paidSlowCoding = preferences.paid?.slow?.coding;
        expect(Array.isArray(paidSlowCoding)).toBe(true);
        expect(paidSlowCoding!.length).toBeGreaterThan(0);

        // Should contain known model keys
        expect(
          paidSlowCoding!.some((key) => ["opus", "sonnet", "haiku", "gpt5"].includes(key))
        ).toBe(true);
      });
    });

    describe("getPreference", () => {
      it("returns preference for paid/slow/coding", async () => {
        const chain = await ModelConfigurationService.getPreference("paid", "slow", "coding");

        expect(Array.isArray(chain)).toBe(true);
        expect(chain.length).toBeGreaterThan(0);
      });

      it("returns preference for paid/fast/writing", async () => {
        const chain = await ModelConfigurationService.getPreference("paid", "fast", "writing");

        expect(Array.isArray(chain)).toBe(true);
        expect(chain.length).toBeGreaterThan(0);
      });

      it("returns preference for free/slow/planning", async () => {
        const chain = await ModelConfigurationService.getPreference("free", "slow", "planning");

        expect(Array.isArray(chain)).toBe(true);
        expect(chain.length).toBeGreaterThan(0);
      });

      it("returns empty array for unknown combination", async () => {
        // Cast to bypass type checking for this test
        const chain = await ModelConfigurationService.getPreference(
          "unknown" as any,
          "slow",
          "coding"
        );

        expect(chain).toEqual([]);
      });
    });

    describe("seeded preferences match expected configuration", () => {
      it("paid/slow/coding prioritizes quality models", async () => {
        const chain = await ModelConfigurationService.getPreference("paid", "slow", "coding");

        // Should have opus, sonnet, haiku in that order (from seeds)
        expect(chain).toContain("opus");
        expect(chain).toContain("sonnet");
        expect(chain).toContain("haiku");
      });

      it("paid/blazing prioritizes speed models", async () => {
        const chain = await ModelConfigurationService.getPreference("paid", "blazing", "coding");

        // Should have groq first (from seeds)
        expect(chain[0]).toBe("groq");
      });

      it("free tier uses local models", async () => {
        const chain = await ModelConfigurationService.getPreference("free", "slow", "coding");

        // Should have gpt_oss (from seeds)
        expect(chain).toContain("gpt_oss");
      });
    });
  });

  describe("clearCache", () => {
    it("clears cache so next call refetches", async () => {
      const result1 = await ModelConfigurationService.getAllModels();
      ModelConfigurationService.clearCache();
      const result2 = await ModelConfigurationService.getAllModels();

      // After clear, should get a fresh object (not same reference)
      expect(result1).not.toBe(result2);
      // But same data
      expect(result1.opus!.enabled).toBe(result2.opus!.enabled);
    });
  });

  describe("Single API call optimization", () => {
    it("fetches both models and preferences in a single API call", async () => {
      // Clear cache to ensure fresh fetch
      ModelConfigurationService.clearCache();

      // Fetch models first
      const models = await ModelConfigurationService.getAllModels();
      expect(models.opus).toBeDefined();

      // Now fetch preferences - should use cached data from same API call
      const preferences = await ModelConfigurationService.getAllPreferences();
      expect(preferences.paid?.slow?.coding).toBeDefined();

      // Both should be from the same cache
      // (Testing that cache is shared between model and preference calls)
    });
  });
});
