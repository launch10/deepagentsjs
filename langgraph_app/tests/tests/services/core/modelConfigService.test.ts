import { describe, it, expect, beforeEach } from "vitest";
import { ModelConfigService } from "../../../../app/services/core/modelConfigService";

/**
 * Integration tests for ModelConfigService.
 * These tests hit the real Rails API using seeded data.
 * Run `cd ../rails_app && bundle exec rails db:seed` to ensure seeds exist.
 */
describe("ModelConfigService", () => {
  beforeEach(() => {
    ModelConfigService.clearCache();
  });

  describe("getAll", () => {
    it("fetches model configs from Rails API", async () => {
      const configs = await ModelConfigService.getAll();

      // Should have all seeded models
      expect(configs.opus).toBeDefined();
      expect(configs.sonnet).toBeDefined();
      expect(configs.haiku).toBeDefined();
      expect(configs.groq).toBeDefined();
      expect(configs.gpt5).toBeDefined();
    });

    it("returns expected structure for each model", async () => {
      const configs = await ModelConfigService.getAll();
      const opus = configs.opus;

      expect(opus).toHaveProperty("enabled");
      expect(opus).toHaveProperty("maxUsagePercent");
      expect(opus).toHaveProperty("costIn");
      expect(opus).toHaveProperty("costOut");
      expect(opus).toHaveProperty("modelCard");
    });

    it("returns correct model cards", async () => {
      const configs = await ModelConfigService.getAll();

      expect(configs.opus!.modelCard).toBe("claude-opus-4-5");
      expect(configs.sonnet!.modelCard).toBe("claude-sonnet-4-5");
      expect(configs.haiku!.modelCard).toBe("claude-haiku-4-5");
    });

    it("caches results - same data returned", async () => {
      const result1 = await ModelConfigService.getAll();
      const result2 = await ModelConfigService.getAll();

      // Same cached data
      expect(result1).toStrictEqual(result2);
    });
  });

  describe("get", () => {
    it("returns config for a specific model", async () => {
      const opusConfig = await ModelConfigService.get("opus");

      expect(opusConfig).toBeDefined();
      expect(opusConfig!.enabled).toBe(false); // Opus is disabled by default
      expect(opusConfig!.maxUsagePercent).toBe(80);
    });

    it("returns undefined for unknown model", async () => {
      const unknownConfig = await ModelConfigService.get("unknown_model_xyz");

      expect(unknownConfig).toBeUndefined();
    });
  });

  describe("isEnabled", () => {
    it("returns false for opus (disabled by seed)", async () => {
      const isEnabled = await ModelConfigService.isEnabled("opus");
      expect(isEnabled).toBe(false);
    });

    it("returns true for sonnet (enabled by seed)", async () => {
      const isEnabled = await ModelConfigService.isEnabled("sonnet");
      expect(isEnabled).toBe(true);
    });

    it("returns true by default for unknown model", async () => {
      const isEnabled = await ModelConfigService.isEnabled("unknown_model_xyz");
      expect(isEnabled).toBe(true);
    });
  });

  describe("getMaxUsagePercent", () => {
    it("returns seeded value for opus", async () => {
      const maxUsage = await ModelConfigService.getMaxUsagePercent("opus");
      expect(maxUsage).toBe(80);
    });

    it("returns seeded value for sonnet", async () => {
      const maxUsage = await ModelConfigService.getMaxUsagePercent("sonnet");
      expect(maxUsage).toBe(90);
    });

    it("returns seeded value for haiku", async () => {
      const maxUsage = await ModelConfigService.getMaxUsagePercent("haiku");
      expect(maxUsage).toBe(95);
    });

    it("returns 100 by default for unknown model", async () => {
      const maxUsage = await ModelConfigService.getMaxUsagePercent("unknown_model_xyz");
      expect(maxUsage).toBe(100);
    });
  });

  describe("clearCache", () => {
    it("clears cache so next call refetches", async () => {
      const result1 = await ModelConfigService.getAll();
      ModelConfigService.clearCache();
      const result2 = await ModelConfigService.getAll();

      // After clear, should get a fresh object (not same reference)
      expect(result1).not.toBe(result2);
      // But same data
      expect(result1.opus!.enabled).toBe(result2.opus!.enabled);
    });
  });
});
