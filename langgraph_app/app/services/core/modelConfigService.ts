import { createRailsApiClient } from "@rails_api";
import type { ModelConfigData, ModelConfigsResponse } from "@core";

/**
 * Service for fetching dynamic LLM model configurations from Rails.
 * Caches results for 5 minutes to reduce API calls.
 */
export class ModelConfigService {
  private static cache: ModelConfigsResponse | null = null;
  private static cacheExpiry = 0;
  private static readonly CACHE_TTL_MS = 5 * 60_000; // 5 minutes

  /**
   * Fetch all model configurations from Rails API.
   * Results are cached for 5 minutes.
   */
  static async getAll(): Promise<Record<string, ModelConfigData>> {
    if (this.cache && Date.now() < this.cacheExpiry) {
      return this.cache.models;
    }

    try {
      const client = await createRailsApiClient({});
      const response = await client.GET("/api/v1/model_configs" as any, {});
      if (response.data) {
        this.cache = response.data as ModelConfigsResponse;
        this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
        return this.cache.models;
      }
    } catch (error) {
      console.error("Failed to fetch model configs", error);
    }

    return this.getDefaults();
  }

  /**
   * Get configuration for a specific model.
   */
  static async get(modelKey: string): Promise<ModelConfigData | undefined> {
    const configs = await this.getAll();
    return configs[modelKey];
  }

  /**
   * Check if a model is enabled.
   * Returns true by default for unknown models.
   */
  static async isEnabled(modelKey: string): Promise<boolean> {
    const config = await this.get(modelKey);
    return config?.enabled ?? true;
  }

  /**
   * Get the maximum usage percentage for a model.
   * Returns 100 by default for unknown models or null values.
   */
  static async getMaxUsagePercent(modelKey: string): Promise<number> {
    const config = await this.get(modelKey);
    return config?.maxUsagePercent ?? 100;
  }

  /**
   * Get the model card (API model identifier) for a model.
   * Returns undefined if not found.
   */
  static async getModelCard(modelKey: string): Promise<string | undefined> {
    const config = await this.get(modelKey);
    return config?.modelCard ?? undefined;
  }

  /**
   * Clear the cache. Useful for tests.
   */
  static clearCache(): void {
    this.cache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Default configurations used when API is unavailable.
   * These match the seeded values in Rails.
   */
  private static getDefaults(): Record<string, ModelConfigData> {
    return {
      opus: {
        enabled: false,
        maxUsagePercent: 80,
        costIn: 15.0,
        costOut: 75.0,
        modelCard: "claude-opus-4-5",
      },
      sonnet: {
        enabled: true,
        maxUsagePercent: 90,
        costIn: 3.0,
        costOut: 15.0,
        modelCard: "claude-sonnet-4-5",
      },
      haiku: {
        enabled: true,
        maxUsagePercent: 95,
        costIn: 1.0,
        costOut: 5.0,
        modelCard: "claude-haiku-4-5",
      },
      groq: {
        enabled: true,
        maxUsagePercent: 90,
        costIn: 1.25,
        costOut: 10.0,
        modelCard: "openai/gpt-oss-120b",
      },
      gpt5: {
        enabled: true,
        maxUsagePercent: 100,
        costIn: 1.25,
        costOut: 10.0,
        modelCard: "gpt-5",
      },
      gpt5_mini: {
        enabled: true,
        maxUsagePercent: 100,
        costIn: 0.25,
        costOut: 2.0,
        modelCard: "gpt-5-mini",
      },
      gemini_flash: {
        enabled: true,
        maxUsagePercent: 100,
        costIn: 0.3,
        costOut: 2.5,
        modelCard: "gemini-1.5-flash-latest",
      },
    };
  }
}
