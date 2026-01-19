import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { env } from "@app";
import { cache } from "@core";
import { createRailsApiClient } from "@rails_api";
import { LLMTestResponder } from "./test";
import type {
  LLMProvider,
  LLMSkill,
  LLMSpeed,
  LLMCost,
  ModelConfig,
  ModelConfigurationResponse,
} from "./types";

const CACHE_KEY = "llm:model_configuration";
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

// Provider configuration - maps provider to LangChain class + API key
const PROVIDERS: Record<
  LLMProvider,
  {
    Client: typeof ChatAnthropic | typeof ChatOpenAI | typeof ChatGroq | typeof ChatOllama;
    apiKey: string | null;
  }
> = {
  anthropic: { Client: ChatAnthropic, apiKey: env.ANTHROPIC_API_KEY },
  openai: { Client: ChatOpenAI, apiKey: env.OPENAI_API_KEY },
  groq: { Client: ChatGroq, apiKey: env.GROQ_API_KEY },
  ollama: { Client: ChatOllama, apiKey: null },
};

// Model key → provider mapping (until Rails provides this via API)
// TODO: Add provider field to ModelConfig in Rails and remove this mapping
const MODEL_PROVIDERS: Record<string, LLMProvider> = {
  opus: "anthropic",
  sonnet: "anthropic",
  haiku: "anthropic",
  haiku3: "anthropic",
  groq: "groq",
  gpt5: "openai",
  gpt5_mini: "openai",
  gpt_oss: "ollama",
  gemini_flash: "openai",
};

/**
 * Unified LLM service - fetches config from Rails and creates model instances.
 * Uses Redis for caching to minimize API overhead.
 */
class LLMService {
  private mode: "test" | "regular" = "regular";
  private testConfig: ModelConfigurationResponse | null = null;

  // ============ Config Fetching ============

  private async fetchConfig(): Promise<ModelConfigurationResponse> {
    // In test mode with custom config, return it directly (bypass cache and API)
    if (this.testConfig) {
      return this.testConfig;
    }

    return cache.fetch(
      CACHE_KEY,
      async () => {
        try {
          const jwt = env.NODE_ENV === "test" ? "test-jwt" : "service-call";
          const client = await createRailsApiClient({ jwt });
          // TODO: Add rswag specs to Rails controller so this endpoint is in generated types
          const response = await client.GET("/api/v1/model_configuration" as any, {});
          if (response.data) {
            return response.data as ModelConfigurationResponse;
          }
        } catch (error) {
          console.error("Failed to fetch model configuration from Rails", error);
        }
        return this.getDefaults();
      },
      CACHE_TTL_SECONDS
    );
  }

  private getDefaults(): ModelConfigurationResponse {
    return {
      models: {
        opus: {
          enabled: false,
          maxUsagePercent: 80,
          costIn: 15.0,
          costOut: 75.0,
          modelCard: "claude-opus-4-5",
          provider: "anthropic",
          priceTier: 1, // 15 + (75 * 4) = 315
        },
        sonnet: {
          enabled: true,
          maxUsagePercent: 90,
          costIn: 3.0,
          costOut: 15.0,
          modelCard: "claude-sonnet-4-5",
          provider: "anthropic",
          priceTier: 2, // 3 + (15 * 4) = 63
        },
        haiku: {
          enabled: true,
          maxUsagePercent: 95,
          costIn: 1.0,
          costOut: 5.0,
          modelCard: "claude-haiku-4-5",
          provider: "anthropic",
          priceTier: 3, // 1 + (5 * 4) = 21
        },
        haiku3: {
          enabled: true,
          maxUsagePercent: 100,
          costIn: 0.25,
          costOut: 1.25,
          modelCard: "claude-3-5-haiku-latest",
          provider: "anthropic",
          priceTier: 4, // 0.25 + (1.25 * 4) = 5.25
        },
        groq: {
          enabled: true,
          maxUsagePercent: 90,
          costIn: 1.25,
          costOut: 10.0,
          modelCard: "openai/gpt-oss-120b",
          provider: "groq",
          priceTier: 2, // 1.25 + (10 * 4) = 41.25
        },
        gpt5: {
          enabled: true,
          maxUsagePercent: 100,
          costIn: 1.25,
          costOut: 10.0,
          modelCard: "gpt-5",
          provider: "openai",
          priceTier: 2, // 1.25 + (10 * 4) = 41.25
        },
        gpt5_mini: {
          enabled: true,
          maxUsagePercent: 100,
          costIn: 0.25,
          costOut: 2.0,
          modelCard: "gpt-5-mini",
          provider: "openai",
          priceTier: 4, // 0.25 + (2 * 4) = 8.25
        },
        gpt_oss: {
          enabled: true,
          maxUsagePercent: 100,
          costIn: 0,
          costOut: 0,
          modelCard: "gpt-oss:20b",
          provider: "ollama",
          priceTier: 5, // 0 + (0 * 4) = 0
        },
        gemini_flash: {
          enabled: true,
          maxUsagePercent: 100,
          costIn: 0.3,
          costOut: 2.5,
          modelCard: "gemini-1.5-flash-latest",
          provider: "openai",
          priceTier: 4, // 0.3 + (2.5 * 4) = 10.3
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
            writing: ["haiku", "gpt5_mini"],
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

  // ============ Model Creation ============

  private createModel(modelKey: string, config: ModelConfig): BaseChatModel | null {
    // Get provider from config or fall back to local mapping
    const provider = config.provider ?? MODEL_PROVIDERS[modelKey];
    if (!provider) return null;

    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) return null;

    // API providers need valid API keys
    if (provider !== "ollama" && !providerConfig.apiKey) return null;

    const { Client, apiKey } = providerConfig;

    const model = new Client({
      apiKey: apiKey ?? undefined,
      model: config.modelCard ?? modelKey,
      temperature: 0,
    } as any);

    // WORKAROUND: @langchain/anthropic bug where topP/topK default to -1 for newer models
    if (provider === "anthropic") {
      (model as any).topP = undefined;
      (model as any).topK = undefined;
    }

    return model;
  }

  // ============ Public API ============

  /**
   * Get a single model for the given skill/speed/cost combination.
   * Returns the first available model from the preference chain.
   *
   * @param skill - The skill needed (planning, writing, coding, reasoning)
   * @param speed - Speed preference (blazing, fast, slow)
   * @param cost - Cost tier (free or paid)
   * @param usagePercent - Current user's usage percentage (0-100)
   * @param maxTier - Maximum price tier allowed (1=premium only, 5=any tier). Models with higher tier numbers (cheaper) are allowed.
   */
  async get(
    skill: LLMSkill,
    speed: LLMSpeed,
    cost: LLMCost,
    usagePercent: number = 0,
    maxTier?: number
  ): Promise<BaseChatModel> {
    if (this.useTest()) {
      return LLMTestResponder.get();
    }

    const config = await this.fetchConfig();
    const modelKeys = config.preferences[cost]?.[speed]?.[skill] ?? [];

    for (const key of modelKeys) {
      const modelConfig = config.models[key];
      if (!modelConfig?.enabled) continue;
      if (usagePercent > (modelConfig.maxUsagePercent ?? 100)) continue;
      // Filter by maxTier: only allow models with tier >= maxTier (higher tier = cheaper)
      if (maxTier !== undefined && modelConfig.priceTier < maxTier) continue;

      console.log(`Using tier ${modelConfig.priceTier} model ${key}`);
      const model = this.createModel(key, modelConfig);
      if (model) return model;
    }

    const tierMsg = maxTier !== undefined ? ` with maxTier=${maxTier}` : "";
    throw new Error(`No available model for ${skill}/${speed}/${cost} at ${usagePercent}% usage${tierMsg}`);
  }

  /**
   * Get the model key that would be selected for the given parameters.
   * Useful for testing to verify which model is selected without needing API keys.
   * When testConfig is set, skips API key validation.
   *
   * @param skill - The skill needed (planning, writing, coding, reasoning)
   * @param speed - Speed preference (blazing, fast, slow)
   * @param cost - Cost tier (free or paid)
   * @param usagePercent - Current user's usage percentage (0-100)
   * @param maxTier - Maximum price tier allowed (1=premium only, 5=any tier). Models with higher tier numbers (cheaper) are allowed.
   */
  async getModelKey(
    skill: LLMSkill,
    speed: LLMSpeed,
    cost: LLMCost,
    usagePercent: number = 0,
    maxTier?: number
  ): Promise<string> {
    const config = await this.fetchConfig();
    const modelKeys = config.preferences[cost]?.[speed]?.[skill] ?? [];
    const skipApiKeyCheck = this.testConfig !== null;

    for (const key of modelKeys) {
      const modelConfig = config.models[key];
      if (!modelConfig?.enabled) continue;
      if (usagePercent > (modelConfig.maxUsagePercent ?? 100)) continue;
      // Filter by maxTier: only allow models with tier >= maxTier (higher tier = cheaper)
      if (maxTier !== undefined && modelConfig.priceTier < maxTier) continue;

      // Check if this model could be created (has valid provider config)
      const provider = modelConfig.provider ?? MODEL_PROVIDERS[key];
      if (!provider) continue;

      const providerConfig = PROVIDERS[provider];
      if (!providerConfig) continue;

      // For API providers, we need a valid API key (unless in test mode with test config)
      if (!skipApiKeyCheck && provider !== "ollama" && !providerConfig.apiKey) continue;

      return key;
    }

    const tierMsg = maxTier !== undefined ? ` with maxTier=${maxTier}` : "";
    throw new Error(`No available model for ${skill}/${speed}/${cost} at ${usagePercent}% usage${tierMsg}`);
  }

  /**
   * Get all available model keys for the given parameters.
   * Useful for testing fallback chains.
   * When testConfig is set, skips API key validation.
   *
   * @param skill - The skill needed (planning, writing, coding, reasoning)
   * @param speed - Speed preference (blazing, fast, slow)
   * @param cost - Cost tier (free or paid)
   * @param usagePercent - Current user's usage percentage (0-100)
   * @param maxTier - Maximum price tier allowed (1=premium only, 5=any tier). Models with higher tier numbers (cheaper) are allowed.
   */
  async getModelKeys(
    skill: LLMSkill,
    speed: LLMSpeed,
    cost: LLMCost,
    usagePercent: number = 0,
    maxTier?: number
  ): Promise<string[]> {
    const config = await this.fetchConfig();
    const modelKeys = config.preferences[cost]?.[speed]?.[skill] ?? [];
    const availableKeys: string[] = [];
    const skipApiKeyCheck = this.testConfig !== null;

    for (const key of modelKeys) {
      const modelConfig = config.models[key];
      if (!modelConfig?.enabled) continue;
      if (usagePercent > (modelConfig.maxUsagePercent ?? 100)) continue;
      // Filter by maxTier: only allow models with tier >= maxTier (higher tier = cheaper)
      if (maxTier !== undefined && modelConfig.priceTier < maxTier) continue;

      const provider = modelConfig.provider ?? MODEL_PROVIDERS[key];
      if (!provider) continue;

      const providerConfig = PROVIDERS[provider];
      if (!providerConfig) continue;

      if (!skipApiKeyCheck && provider !== "ollama" && !providerConfig.apiKey) continue;

      availableKeys.push(key);
    }

    return availableKeys;
  }

  /**
   * Get all available models for fallback chains.
   * Returns models in priority order (first is primary).
   *
   * @param skill - The skill needed (planning, writing, coding, reasoning)
   * @param speed - Speed preference (blazing, fast, slow)
   * @param cost - Cost tier (free or paid)
   * @param usagePercent - Current user's usage percentage (0-100)
   * @param maxTier - Maximum price tier allowed (1=premium only, 5=any tier). Models with higher tier numbers (cheaper) are allowed.
   */
  async getFallbacks(
    skill: LLMSkill,
    speed: LLMSpeed,
    cost: LLMCost,
    usagePercent: number = 0,
    maxTier?: number
  ): Promise<BaseChatModel[]> {
    if (this.useTest()) {
      return [LLMTestResponder.get()];
    }

    const config = await this.fetchConfig();
    const modelKeys = config.preferences[cost]?.[speed]?.[skill] ?? [];
    const models: BaseChatModel[] = [];

    for (const key of modelKeys) {
      const modelConfig = config.models[key];
      if (!modelConfig?.enabled) continue;
      if (usagePercent > (modelConfig.maxUsagePercent ?? 100)) continue;
      // Filter by maxTier: only allow models with tier >= maxTier (higher tier = cheaper)
      if (maxTier !== undefined && modelConfig.priceTier < maxTier) continue;

      const model = this.createModel(key, modelConfig);
      if (model) models.push(model);
    }

    if (models.length === 0) {
      const tierMsg = maxTier !== undefined ? ` with maxTier=${maxTier}` : "";
      throw new Error(
        `No available models for ${skill}/${speed}/${cost} at ${usagePercent}% usage${tierMsg}`
      );
    }

    return models;
  }

  // ============ Test Support ============

  testMode() {
    if (env.NODE_ENV === "test") {
      this.mode = "test";
    } else {
      throw new Error("testMode() can only be called in test environment");
    }
  }

  /**
   * Set a custom configuration for testing. Bypasses cache and API.
   * Only callable in test environment.
   */
  setConfigForTesting(config: ModelConfigurationResponse) {
    if (env.NODE_ENV !== "test") {
      throw new Error("setConfigForTesting() can only be called in test environment");
    }
    this.testConfig = config;
  }

  /**
   * Clear the test configuration.
   */
  clearTestConfig() {
    this.testConfig = null;
  }

  reset() {
    this.mode = "regular";
    this.testConfig = null;
    // Clear cache synchronously via fire-and-forget to ensure fresh config on next fetch
    cache.delete(CACHE_KEY).catch(() => {});
  }

  useTest() {
    return this.mode === "test";
  }

  configureFixtures(...args: Parameters<typeof LLMTestResponder.configure>) {
    this.testMode();
    LLMTestResponder.configure(...args);
  }

  resetTestResponses() {
    this.reset();
    LLMTestResponder.reset();
  }

  async clearCache() {
    await cache.delete(CACHE_KEY);
  }
}

// Export singleton instance
export const LLMManager = new LLMService();
