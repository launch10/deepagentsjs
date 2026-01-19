import { BaseChatModel } from "@langchain/core/language_models/chat_models";
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

type ModelWithDetails = {
  model: BaseChatModel,
  config: ModelConfig
}

/**
 * Unified LLM service - fetches config from Rails and creates model instances.
 * Uses Redis for caching to minimize API overhead.
 */
class LLMService {
  private mode: "test" | "regular" = "regular";
  private _ignoreEnvMaxTier: boolean = false;

  // ============ Config Fetching ============

  private async fetchConfig(): Promise<ModelConfigurationResponse> {
    return cache.fetch(
      CACHE_KEY,
      async () => {
        // Use internal service call auth (signature only, no JWT) for service-to-service communication
        const client = await createRailsApiClient({ internalServiceCall: true });
        // TODO: Add rswag specs to Rails controller so this endpoint is in generated types
        const response = await client.GET("/api/v1/model_configuration" as any, {});
        if (response.data) {
          return response.data as ModelConfigurationResponse;
        }
        throw new Error(
          "Failed to fetch model configuration from Rails. " +
          "Ensure Rails is running and the /api/v1/model_configuration endpoint is available."
        );
      },
      CACHE_TTL_SECONDS
    );
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
    const models = await this.getModels(skill, speed, cost, usagePercent, maxTier)
    const modelWithConfig = models.at(0)
    if (!modelWithConfig) {
      const tierMsg = maxTier !== undefined ? ` with maxTier=${maxTier}` : "";
      throw new Error(`No available model for ${skill}/${speed}/${cost} at ${usagePercent}% usage${tierMsg}`);
    }
    console.log(`Using model tier ${modelWithConfig.config.priceTier} model: ${modelWithConfig.config.modelCard}`)
    return modelWithConfig.model
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
  async getModels(
    skill: LLMSkill,
    speed: LLMSpeed,
    cost: LLMCost,
    usagePercent: number = 0,
    maxTier?: number
  ): Promise<ModelWithDetails[]> {
    if (this.useTest()) {
      return [{
        model: LLMTestResponder.get(),
        config: {} as any
      }];
    }

    const config = await this.fetchConfig();
    const modelKeys = config.preferences[cost]?.[speed]?.[skill] ?? [];
    const models: ModelWithDetails[] = [];

    for (const key of modelKeys) {
      const modelConfig = config.models[key];
      if (!modelConfig?.enabled) continue;
      if (usagePercent > (modelConfig.maxUsagePercent ?? 100)) continue;
      // Filter by maxTier: only allow models with tier >= maxTier (higher tier = cheaper)
      if (maxTier !== undefined && modelConfig.priceTier < maxTier) continue;

      const model = this.createModel(key, modelConfig);
      if (model) models.push({
        model,
        config: modelConfig
      });
    }

    if (models.length === 0) {
      const tierMsg = maxTier !== undefined ? ` with maxTier=${maxTier}` : "";
      throw new Error(
        `No available models for ${skill}/${speed}/${cost} at ${usagePercent}% usage${tierMsg}`
      );
    }

    return models;
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
    return await this.getModels(skill, speed, cost, usagePercent, maxTier)
                     .then(models => models.map(model => model.model));
  }

  // ============ Test Support ============

  testMode() {
    if (env.NODE_ENV === "test") {
      this.mode = "test";
    } else {
      throw new Error("testMode() can only be called in test environment");
    }
  }

  reset() {
    this.mode = "regular";
    this._ignoreEnvMaxTier = false;
    // Clear cache synchronously via fire-and-forget to ensure fresh config on next fetch
    cache.delete(CACHE_KEY).catch(() => {});
  }

  /**
   * Check if env max tier should be ignored (for testing).
   */
  get ignoreEnvMaxTier(): boolean {
    return this._ignoreEnvMaxTier;
  }

  /**
   * Set whether to ignore the LLM_MAX_TIER env var.
   * Only callable in test environment.
   */
  setIgnoreEnvMaxTier(value: boolean) {
    if (env.NODE_ENV !== "test") {
      throw new Error("setIgnoreEnvMaxTier() can only be called in test environment");
    }
    this._ignoreEnvMaxTier = value;
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
