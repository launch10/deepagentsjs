import { createRailsApiClient } from "@rails_api";
import type { LLMCost, LLMSpeed, LLMSkill, ModelConfigData } from "@core";

/**
 * Nested structure of model preferences from Rails API.
 * preferences[costTier][speedTier][skill] = ["model_key1", "model_key2", ...]
 */
export type ModelPreferencesData = Record<string, Record<string, Record<string, string[]>>>;

interface ModelConfigurationResponse {
  models: Record<string, ModelConfigData>;
  preferences: ModelPreferencesData;
  updatedAt: string;
}

/**
 * Unified service for fetching all LLM configuration from Rails.
 * Makes a single API call to get both model configs and preferences.
 * Caches results for 5 minutes to reduce API calls.
 */
export class ModelConfigurationService {
  private static cache: ModelConfigurationResponse | null = null;
  private static cacheExpiry = 0;
  private static readonly CACHE_TTL_MS = 5 * 60_000; // 5 minutes

  /**
   * Fetch all model configuration from Rails API.
   * Returns both models and preferences in a single call.
   */
  private static async fetchAll(): Promise<ModelConfigurationResponse> {
    if (this.cache && Date.now() < this.cacheExpiry) {
      return this.cache;
    }

    try {
      const client = await createRailsApiClient({});
      const response = await client.GET("/api/v1/model_configuration" as any, {});
      if (response.data) {
        this.cache = response.data as ModelConfigurationResponse;
        this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
        return this.cache;
      }
    } catch (error) {
      console.error("Failed to fetch model configuration", error);
    }

    return this.getDefaults();
  }

  // ============ Model Config Methods ============

  /**
   * Fetch all model configurations.
   */
  static async getAllModels(): Promise<Record<string, ModelConfigData>> {
    const data = await this.fetchAll();
    return data.models;
  }

  /**
   * Get configuration for a specific model.
   */
  static async getModel(modelKey: string): Promise<ModelConfigData | undefined> {
    const models = await this.getAllModels();
    return models[modelKey];
  }

  /**
   * Check if a model is enabled.
   * Returns true by default for unknown models.
   */
  static async isEnabled(modelKey: string): Promise<boolean> {
    const config = await this.getModel(modelKey);
    return config?.enabled ?? true;
  }

  /**
   * Get the maximum usage percentage for a model.
   * Returns 100 by default for unknown models or null values.
   */
  static async getMaxUsagePercent(modelKey: string): Promise<number> {
    const config = await this.getModel(modelKey);
    return config?.maxUsagePercent ?? 100;
  }

  /**
   * Get the model card (API model identifier) for a model.
   * Returns undefined if not found.
   */
  static async getModelCard(modelKey: string): Promise<string | undefined> {
    const config = await this.getModel(modelKey);
    return config?.modelCard ?? undefined;
  }

  // ============ Model Preferences Methods ============

  /**
   * Fetch all model preferences.
   */
  static async getAllPreferences(): Promise<ModelPreferencesData> {
    const data = await this.fetchAll();
    return data.preferences;
  }

  /**
   * Get the preference chain for a specific cost/speed/skill combination.
   * Returns an array of model_keys in priority order (first is primary).
   */
  static async getPreference(
    costTier: LLMCost,
    speedTier: LLMSpeed,
    skill: LLMSkill
  ): Promise<string[]> {
    const preferences = await this.getAllPreferences();
    return preferences[costTier]?.[speedTier]?.[skill] ?? [];
  }

  // ============ Cache Management ============

  /**
   * Clear the cache. Useful for tests.
   */
  static clearCache(): void {
    this.cache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Default configuration used when API is unavailable.
   * These match the seeded values in Rails.
   */
  private static getDefaults(): ModelConfigurationResponse {
    return {
      models: {
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
      },
      preferences: {
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
      },
      updatedAt: new Date().toISOString(),
    };
  }
}
