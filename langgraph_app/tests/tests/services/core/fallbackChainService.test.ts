import { describe, it, expect, beforeEach } from "vitest";
import { FallbackChainService } from "../../../../app/services/core/fallbackChainService";

/**
 * Integration tests for FallbackChainService.
 * These tests hit the real Rails API using seeded data.
 * Run `cd ../rails_app && bundle exec rails db:seed` to ensure seeds exist.
 */
describe("FallbackChainService", () => {
  beforeEach(() => {
    FallbackChainService.clearCache();
  });

  describe("getAll", () => {
    it("fetches fallback chains from Rails API", async () => {
      const chains = await FallbackChainService.getAll();

      // Should have both cost tiers
      expect(chains.paid).toBeDefined();
      expect(chains.free).toBeDefined();
    });

    it("returns expected nested structure", async () => {
      const chains = await FallbackChainService.getAll();

      // Check paid tier structure
      expect(chains.paid?.slow).toBeDefined();
      expect(chains.paid?.fast).toBeDefined();
      expect(chains.paid?.blazing).toBeDefined();

      // Check skills within paid/slow
      expect(chains.paid?.slow?.coding).toBeDefined();
      expect(chains.paid?.slow?.writing).toBeDefined();
      expect(chains.paid?.slow?.planning).toBeDefined();
      expect(chains.paid?.slow?.reasoning).toBeDefined();
    });

    it("returns arrays of model keys for each chain", async () => {
      const chains = await FallbackChainService.getAll();

      const paidSlowCoding = chains.paid?.slow?.coding;
      expect(Array.isArray(paidSlowCoding)).toBe(true);
      expect(paidSlowCoding!.length).toBeGreaterThan(0);

      // Should contain known model keys
      expect(paidSlowCoding!.some((key) => ["opus", "sonnet", "haiku", "gpt5"].includes(key))).toBe(
        true
      );
    });

    it("caches results - same data returned", async () => {
      const result1 = await FallbackChainService.getAll();
      const result2 = await FallbackChainService.getAll();

      // Same cached data
      expect(result1).toStrictEqual(result2);
    });
  });

  describe("getChain", () => {
    it("returns chain for paid/slow/coding", async () => {
      const chain = await FallbackChainService.getChain("paid", "slow", "coding");

      expect(Array.isArray(chain)).toBe(true);
      expect(chain.length).toBeGreaterThan(0);
    });

    it("returns chain for paid/fast/writing", async () => {
      const chain = await FallbackChainService.getChain("paid", "fast", "writing");

      expect(Array.isArray(chain)).toBe(true);
      expect(chain.length).toBeGreaterThan(0);
    });

    it("returns chain for free/slow/planning", async () => {
      const chain = await FallbackChainService.getChain("free", "slow", "planning");

      expect(Array.isArray(chain)).toBe(true);
      expect(chain.length).toBeGreaterThan(0);
    });

    it("returns empty array for unknown combination", async () => {
      // Cast to bypass type checking for this test
      const chain = await FallbackChainService.getChain("unknown" as any, "slow", "coding");

      expect(chain).toEqual([]);
    });
  });

  describe("clearCache", () => {
    it("clears cache so next call refetches", async () => {
      const result1 = await FallbackChainService.getAll();
      FallbackChainService.clearCache();
      const result2 = await FallbackChainService.getAll();

      // After clear, should get a fresh object (not same reference)
      expect(result1).not.toBe(result2);
      // But same data
      expect(result1.paid?.slow?.coding).toEqual(result2.paid?.slow?.coding);
    });
  });

  describe("seeded fallback chains match expected configuration", () => {
    it("paid/slow/coding prioritizes quality models", async () => {
      const chain = await FallbackChainService.getChain("paid", "slow", "coding");

      // Should have opus, sonnet, haiku in that order (from seeds)
      expect(chain).toContain("opus");
      expect(chain).toContain("sonnet");
      expect(chain).toContain("haiku");
    });

    it("paid/blazing prioritizes speed models", async () => {
      const chain = await FallbackChainService.getChain("paid", "blazing", "coding");

      // Should have groq first (from seeds)
      expect(chain[0]).toBe("groq");
    });

    it("free tier uses local models", async () => {
      const chain = await FallbackChainService.getChain("free", "slow", "coding");

      // Should have gpt_oss (from seeds)
      expect(chain).toContain("gpt_oss");
    });
  });
});
