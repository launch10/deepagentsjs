import { type BaseChatModel } from "@langchain/core/language_models/chat_models";
import { env } from "@app";
import { LLMTestResponder } from "./test";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOllama } from "@langchain/ollama";
import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";
import {
  type LLMAppConfig,
  type LLMFallbackAppConfig,
  type LLMConfig,
  type LLMSkill,
  type LLMSpeed,
  type LLMCost,
  type LLMName,
  type IAPIConfig,
  type ILocalConfig,
  Models,
} from "./types";

export class LLMManagerFactory {
  mode: "test" | "regular" = "regular";
  private config: LLMAppConfig;
  private fallbackConfig: LLMFallbackAppConfig;
  private llmCache: Partial<Record<string, BaseChatModel>>;

  constructor(config: LLMAppConfig, fallbackConfig: LLMFallbackAppConfig) {
    this.llmCache = {};
    this.config = config;
    this.fallbackConfig = fallbackConfig;
  }

  reset() {
    this.mode = "regular";
  }

  testMode() {
    if (env.NODE_ENV === "test") {
      this.mode = "test";
    } else {
      throw new Error("LLMManager.testMode() can only be called in test mode!");
    }
  }

  llmIsConfigured(name: LLMName): boolean {
    let model = Models[name];
    if (!model) {
      return false;
    }

    if (model.type == "api") {
      return (
        "apiKey" in model &&
        !!model.apiKey &&
        typeof model.apiKey === "string" &&
        model.apiKey.length > 0
      );
    }

    return true;
  }

  apiConfigured(config: LLMConfig): config is IAPIConfig {
    const name = config.model;
    return (
      Models[name].type === "api" &&
      !!Models[name].apiKey &&
      typeof Models[name].apiKey === "string" &&
      Models[name].apiKey.length > 0
    );
  }

  localConfigured(config: LLMConfig): config is ILocalConfig {
    const name = config.model;
    return Models[name].type === "local";
  }

  /**
   * Creates a model instance from a config object.
   * Returns null if the model is not properly configured (missing API key, etc.)
   */
  createModelFromConfig(config: LLMConfig): BaseChatModel | null {
    switch (config.provider) {
      case "anthropic":
        if (!this.apiConfigured(config)) {
          return null;
        }
        return new ChatAnthropic({
          apiKey: config.apiKey,
          model: config.modelCard,
          temperature: config.temperature,
        });
      case "openai":
        if (!this.apiConfigured(config)) {
          return null;
        }
        return new ChatOpenAI({
          apiKey: config.apiKey,
          model: config.modelCard,
        });
      case "ollama":
        if (!this.localConfigured(config)) {
          return null;
        }
        return new ChatOllama({
          model: config.modelCard,
          temperature: config.temperature,
        });
      case "groq":
        if (!this.apiConfigured(config)) {
          return null;
        }
        return new ChatGroq({
          apiKey: config.apiKey,
          model: config.modelCard,
          temperature: config.temperature,
        });
      default:
        return null;
    }
  }

  getModel(llmSkill: LLMSkill, llmSpeed: LLMSpeed, llmCost: LLMCost) {
    // Get the specific config for the requested skill, speed, and tier
    const speedConfig = this.config[llmCost]?.[llmSpeed];
    if (!speedConfig) {
      throw new Error(`LLM configuration not found for tier '${llmCost}' and speed '${llmSpeed}'.`);
    }

    const config: LLMConfig | undefined = speedConfig[llmSkill];
    if (!config) {
      throw new Error(
        `LLM configuration not found for skill '${llmSkill}' within tier '${llmCost}' and speed '${llmSpeed}'.`
      );
    }

    const modelInstance = this.createModelFromConfig(config);
    if (!modelInstance) {
      throw new Error(
        `Failed to create model for ${config.provider} - check API keys and configuration`
      );
    }

    return modelInstance;
  }

  /**
   * Get available fallback configs for a given skill/speed/cost combination.
   * Returns configs that are within the usage threshold.
   *
   * @param usagePercent - Current user's usage percentage (0-100). Defaults to 0 (all models available).
   */
  private getAvailableFallbackConfigs(
    llmSkill: LLMSkill,
    llmSpeed: LLMSpeed,
    llmCost: LLMCost,
    usagePercent: number = 0
  ): LLMConfig[] {
    const speedConfig = this.fallbackConfig[llmCost]?.[llmSpeed];
    if (!speedConfig) {
      throw new Error(
        `LLM fallback configuration not found for tier '${llmCost}' and speed '${llmSpeed}'.`
      );
    }

    const configs: LLMConfig[] | undefined = speedConfig[llmSkill];
    if (!configs || configs.length === 0) {
      throw new Error(
        `LLM fallback configuration not found for skill '${llmSkill}' within tier '${llmCost}' and speed '${llmSpeed}'.`
      );
    }

    // Filter configs that are within usage threshold (maxUsagePercent defaults to 100)
    return configs.filter((config) => {
      const maxUsage = config.maxUsagePercent ?? 100;
      return usagePercent <= maxUsage;
    });
  }

  /**
   * Get fallback models for a given skill/speed/cost combination.
   * Returns an array of configured models in priority order (best first).
   * Only includes models that are:
   * - Properly configured (have API keys, etc.)
   * - Within the usage threshold
   *
   * @param usagePercent - Current user's usage percentage (0-100). Defaults to 0 (all models available).
   */
  getFallbackModels(
    llmSkill: LLMSkill,
    llmSpeed: LLMSpeed,
    llmCost: LLMCost,
    usagePercent: number = 0
  ): BaseChatModel[] {
    const availableConfigs = this.getAvailableFallbackConfigs(
      llmSkill,
      llmSpeed,
      llmCost,
      usagePercent
    );

    // Create model instances for each config, filtering out unconfigured ones
    const models: BaseChatModel[] = [];
    for (const config of availableConfigs) {
      const model = this.createModelFromConfig(config);
      if (model) {
        models.push(model);
      }
    }

    if (models.length === 0) {
      throw new Error(
        `No configured models available for skill '${llmSkill}', speed '${llmSpeed}', cost '${llmCost}' at ${usagePercent}% usage. Check API keys and usage thresholds.`
      );
    }

    return models;
  }

  /**
   * Get the first available model from the fallback chain.
   * Respects both usage thresholds and configuration requirements.
   *
   * @param usagePercent - Current user's usage percentage (0-100). Defaults to 0 (all models available).
   */
  getFirstAvailableModel(
    llmSkill: LLMSkill,
    llmSpeed: LLMSpeed,
    llmCost: LLMCost,
    usagePercent: number = 0
  ): BaseChatModel {
    const availableConfigs = this.getAvailableFallbackConfigs(
      llmSkill,
      llmSpeed,
      llmCost,
      usagePercent
    );

    for (const config of availableConfigs) {
      const model = this.createModelFromConfig(config);
      if (model) {
        return model;
      }
    }

    throw new Error(
      `No configured models available for skill '${llmSkill}', speed '${llmSpeed}', cost '${llmCost}' at ${usagePercent}% usage. Check API keys and usage thresholds.`
    );
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

  get(
    llmSkill: LLMSkill,
    llmSpeed: LLMSpeed,
    llmCost: LLMCost,
    usagePercent: number = 0
  ): BaseChatModel {
    if (this.useTest()) {
      return LLMTestResponder.get();
    }

    // When usage filtering is active, use fallback chain to get first available model
    if (usagePercent > 0) {
      return this.getFirstAvailableModel(llmSkill, llmSpeed, llmCost, usagePercent);
    }

    // At 0% usage, use cached models for performance
    const cacheKey = `${llmSkill}-${llmSpeed}-${llmCost}`;
    if (cacheKey in this.llmCache) {
      return this.llmCache[cacheKey]!;
    }
    const result = this.getModel(llmSkill, llmSpeed, llmCost);
    this.llmCache[cacheKey] = result;
    return result;
  }

  /**
   * Get an array of LLM instances for fallback chains.
   * First model is the primary, rest are fallbacks in priority order.
   * Only returns models that are properly configured.
   *
   * @param usagePercent - Current user's usage percentage (0-100). Defaults to 0 (all models available).
   */
  getFallbacks(
    llmSkill: LLMSkill,
    llmSpeed: LLMSpeed,
    llmCost: LLMCost,
    usagePercent: number = 0
  ): BaseChatModel[] {
    if (this.useTest()) {
      return [LLMTestResponder.get()];
    }

    return this.getFallbackModels(llmSkill, llmSpeed, llmCost, usagePercent);
  }
}
