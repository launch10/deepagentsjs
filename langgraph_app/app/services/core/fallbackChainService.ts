import { createRailsApiClient } from "@rails_api";
import type { LLMCost, LLMSpeed, LLMSkill } from "@core";

/**
 * Nested structure of fallback chains from Rails API.
 * chains[costTier][speedTier][skill] = ["model_key1", "model_key2", ...]
 */
export type FallbackChainsData = Record<string, Record<string, Record<string, string[]>>>;

interface FallbackChainsResponse {
  chains: FallbackChainsData;
  updatedAt: string;
}

/**
 * Service for fetching dynamic LLM fallback chain configurations from Rails.
 * Caches results for 5 minutes to reduce API calls.
 */
export class FallbackChainService {
  private static cache: FallbackChainsResponse | null = null;
  private static cacheExpiry = 0;
  private static readonly CACHE_TTL_MS = 5 * 60_000; // 5 minutes

  /**
   * Fetch all fallback chains from Rails API.
   * Results are cached for 5 minutes.
   */
  static async getAll(): Promise<FallbackChainsData> {
    if (this.cache && Date.now() < this.cacheExpiry) {
      return this.cache.chains;
    }

    try {
      const client = await createRailsApiClient({});
      const response = await client.GET("/api/v1/model_fallback_chains" as any, {});
      if (response.data) {
        this.cache = response.data as FallbackChainsResponse;
        this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
        return this.cache.chains;
      }
    } catch (error) {
      console.error("Failed to fetch fallback chains", error);
    }

    return this.getDefaults();
  }

  /**
   * Get the fallback chain for a specific cost/speed/skill combination.
   * Returns an array of model_keys in priority order (first is primary).
   */
  static async getChain(
    costTier: LLMCost,
    speedTier: LLMSpeed,
    skill: LLMSkill
  ): Promise<string[]> {
    const chains = await this.getAll();
    return chains[costTier]?.[speedTier]?.[skill] ?? [];
  }

  /**
   * Clear the cache. Useful for tests.
   */
  static clearCache(): void {
    this.cache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Default fallback chains used when API is unavailable.
   * These match the seeded values in Rails.
   */
  private static getDefaults(): FallbackChainsData {
    return {
      free: {
        blazing: {
          planning: ["gpt_oss"],
          writing: ["gpt_oss"],
          coding: ["gpt_oss"],
          reasoning: ["gpt_oss"],
        },
        fast: {
          planning: ["gpt_oss"],
          writing: ["gpt_oss"],
          coding: ["gpt_oss"],
          reasoning: ["gpt_oss"],
        },
        slow: {
          planning: ["gpt_oss"],
          writing: ["gpt_oss"],
          coding: ["gpt_oss"],
          reasoning: ["gpt_oss"],
        },
      },
      paid: {
        blazing: {
          planning: ["groq", "haiku", "haiku3"],
          writing: ["groq", "haiku", "haiku3"],
          coding: ["groq", "haiku", "haiku3"],
          reasoning: ["groq", "haiku", "haiku3"],
        },
        fast: {
          planning: ["sonnet", "haiku", "gpt5"],
          writing: ["haiku", "haiku3", "gpt5_mini"],
          coding: ["haiku", "sonnet", "gpt5"],
          reasoning: ["haiku", "sonnet", "gpt5"],
        },
        slow: {
          planning: ["opus", "sonnet", "haiku", "gpt5"],
          writing: ["sonnet", "haiku", "gpt5"],
          coding: ["opus", "sonnet", "haiku", "gpt5"],
          reasoning: ["opus", "sonnet", "haiku", "gpt5"],
        },
      },
    };
  }
}
