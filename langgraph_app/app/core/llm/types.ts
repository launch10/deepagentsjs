import { z } from "zod";
import { env } from "@app";
import type { ValueOf } from "type-fest";

// LLM Providers
export const LLMProviders = ["anthropic", "ollama", "openai", "groq", "google", "fake"] as const;
export type LLMProvider = (typeof LLMProviders)[number];

// LLM Speeds
export const LLMSpeeds = ["fast", "slow", "blazing"] as const;
export type LLMSpeed = (typeof LLMSpeeds)[number];

// LLM Costs
export const LLMCosts = ["free", "paid"] as const;
export type LLMCost = (typeof LLMCosts)[number];

// https://replicate.com/anthropic/claude-4.5-sonnet
export interface LLMAttributes {
  tokensPerSecond: number;
  timeToFirstToken: number;
  contextTokens: number;
  completionTokens: number;
  costIn: number;
  costOut: number;
}

// LLM Model Names
export const LLMNames = {
  Opus: "claude-opus-4-5" as const,
  Sonnet: "claude-sonnet-4-5" as const,
  Haiku: "claude-haiku-4-5" as const,
  Haiku3: "claude-3-haiku-20240307" as const,
  Gpt5: "gpt-5" as const,
  Gpt5Mini: "gpt-5-mini" as const,
  GptOss: "gpt-oss:20b" as const,
  GeminiFlash: "gemini-1.5-flash-latest" as const,
  GroqGptOss120b: "openai/gpt-oss-120b" as const,
  Fake: "fake" as const, // For testing
};

export type LLMName = keyof typeof LLMNames;
export type LLMModelCard = ValueOf<typeof LLMNames>;

export const EstimatedLLMAttributes: Record<LLMName, LLMAttributes> = {
  Opus: {
    tokensPerSecond: 25,
    contextTokens: 200_000,
    completionTokens: 32_000,
    costIn: 15.0,
    costOut: 75.0,
    timeToFirstToken: 2000,
  },
  Sonnet: {
    tokensPerSecond: 40,
    contextTokens: 1_000_000,
    completionTokens: 64_000,
    costIn: 3.0,
    costOut: 15.0,
    timeToFirstToken: 1100,
  },
  Haiku: {
    tokensPerSecond: 90,
    contextTokens: 200_000,
    completionTokens: 64_000,
    costIn: 1.0,
    costOut: 5.0,
    timeToFirstToken: 650,
  },
  Haiku3: {
    tokensPerSecond: 120,
    contextTokens: 200_000,
    completionTokens: 4_096,
    costIn: 0.25,
    costOut: 1.25,
    timeToFirstToken: 400,
  },
  Gpt5: {
    tokensPerSecond: 50,
    contextTokens: 400_000,
    completionTokens: 128_000,
    costIn: 1.25,
    costOut: 10.0,
    timeToFirstToken: 1200,
  },
  Gpt5Mini: {
    tokensPerSecond: 50,
    contextTokens: 400_000,
    completionTokens: 128_000,
    costIn: 0.25,
    costOut: 2.0,
    timeToFirstToken: 1200,
  },
  GptOss: {
    tokensPerSecond: 50,
    contextTokens: 400_000,
    completionTokens: 128_000,
    costIn: 1.25,
    costOut: 10.0,
    timeToFirstToken: 1200,
  },
  GeminiFlash: {
    tokensPerSecond: 170,
    contextTokens: 1_000_000,
    completionTokens: 128_000,
    costIn: 0.3,
    costOut: 2.5,
    timeToFirstToken: 900,
  },
  GroqGptOss120b: {
    tokensPerSecond: 50,
    contextTokens: 400_000,
    completionTokens: 128_000,
    costIn: 1.25,
    costOut: 10.0,
    timeToFirstToken: 1200,
  },
  Fake: {
    tokensPerSecond: 10_000,
    contextTokens: 400_000,
    completionTokens: 128_000,
    costIn: 0.0,
    costOut: 0.0,
    timeToFirstToken: 0,
  },
};

// Temperature
export const temperatureSchema = z.number().min(0).max(1);
export type Temperature = z.infer<typeof temperatureSchema>;

// LLM Skills
export const LLMSkills = ["planning", "writing", "coding", "reasoning"] as const;
export type LLMSkill = (typeof LLMSkills)[number];

// Base Config Interfaces
export interface ILLMConfig {
  type: "local" | "api";
  provider: LLMProvider;
  model: LLMName;
  modelCard: LLMModelCard;
  temperature: Temperature;
  tags?: string[];
  maxTokens: number;
  // Maximum user usage percentage at which this model is available
  // e.g., maxUsagePercent: 80 means model is only used when user's usage is < 80%
  // Defaults to 100 (always available)
  maxUsagePercent?: number;
  // Whether this model is enabled. Set to false to disable without removing from chains.
  // Defaults to true (enabled)
  enabled?: boolean;
}

export interface ILocalConfig extends ILLMConfig {
  type: "local";
}

export interface IAPIConfig extends ILLMConfig {
  type: "api";
  apiKey: string;
}

// Union type for all configs
export type LLMConfig = IAPIConfig | ILocalConfig;

// Environment Configuration
export interface LLMsConfig {
  planning: LLMConfig;
  writing: LLMConfig;
  coding: LLMConfig;
  reasoning: LLMConfig;
}

// Fallback chain configuration - array of configs in priority order
// Each model's maxUsagePercent determines when it's available
export interface LLMsFallbackConfig {
  planning: LLMConfig[];
  writing: LLMConfig[];
  coding: LLMConfig[];
  reasoning: LLMConfig[];
}

export interface LLMAppConfig {
  free: {
    blazing: LLMsConfig;
    fast: LLMsConfig;
    slow: LLMsConfig;
  };
  paid: {
    blazing: LLMsConfig;
    fast: LLMsConfig;
    slow: LLMsConfig;
  };
}

export interface LLMFallbackAppConfig {
  free: {
    blazing: LLMsFallbackConfig;
    fast: LLMsFallbackConfig;
    slow: LLMsFallbackConfig;
  };
  paid: {
    blazing: LLMsFallbackConfig;
    fast: LLMsFallbackConfig;
    slow: LLMsFallbackConfig;
  };
}

const anthropicApiKey = env.ANTHROPIC_API_KEY;
const groqApiKey = env.GROQ_API_KEY;
const googleApiKey = env.GOOGLE_API_KEY;
const openaiApiKey = env.OPENAI_API_KEY;

// Usage thresholds: More expensive models get lower thresholds
// This ensures we preserve budget as users approach their limits

export const OpusConfig: IAPIConfig = {
  type: "api",
  provider: "anthropic",
  model: "Opus",
  modelCard: LLMNames.Opus,
  temperature: 0,
  maxTokens: 32_000,
  apiKey: anthropicApiKey,
  maxUsagePercent: 80, // Most expensive - cut first
  enabled: false,
};

export const SonnetConfig: IAPIConfig = {
  type: "api",
  provider: "anthropic",
  model: "Sonnet",
  modelCard: LLMNames.Sonnet,
  temperature: 0,
  maxTokens: 180_000,
  apiKey: anthropicApiKey,
  maxUsagePercent: 90,
};

export const HaikuConfig: IAPIConfig = {
  type: "api",
  provider: "anthropic",
  model: "Haiku",
  modelCard: LLMNames.Haiku,
  temperature: 0,
  maxTokens: 180_000,
  apiKey: anthropicApiKey,
  maxUsagePercent: 95,
};

export const Haiku3Config: IAPIConfig = {
  type: "api",
  provider: "anthropic",
  model: "Haiku3",
  modelCard: LLMNames.Haiku3,
  temperature: 0,
  maxTokens: 4_096,
  apiKey: anthropicApiKey,
  // No limit - cheapest Claude model, always available
};

export const GroqGptOss120bConfig: IAPIConfig = {
  type: "api",
  provider: "groq",
  model: "GroqGptOss120b",
  modelCard: LLMNames.GroqGptOss120b,
  temperature: 0,
  maxTokens: 128_000,
  apiKey: groqApiKey,
  maxUsagePercent: 90, // External API, moderate limit
};

export const Gpt5Config: IAPIConfig = {
  type: "api",
  provider: "openai",
  model: "Gpt5",
  modelCard: LLMNames.Gpt5,
  temperature: 0,
  maxTokens: 128_000,
  apiKey: openaiApiKey,
  // No limit - fallback option
};

export const Gpt5MiniConfig: IAPIConfig = {
  type: "api",
  provider: "openai",
  model: "Gpt5Mini",
  modelCard: LLMNames.Gpt5Mini,
  temperature: 0,
  maxTokens: 128_000,
  apiKey: openaiApiKey,
  // No limit - cheap fallback
};

export const GptOssConfig: ILocalConfig = {
  type: "local",
  provider: "ollama",
  model: "GptOss",
  modelCard: LLMNames.GptOss,
  temperature: 0,
  maxTokens: 128_000,
  // No limit - local model, always available
};

export const GeminiFlashConfig: IAPIConfig = {
  type: "api",
  provider: "openai",
  model: "GeminiFlash",
  modelCard: LLMNames.GeminiFlash,
  maxTokens: 1_000_000,
  apiKey: googleApiKey,
  temperature: 0,
  // No limit - very cheap
};

export const FakeConfig: ILocalConfig = {
  type: "local",
  provider: "fake",
  model: "Fake",
  modelCard: LLMNames.Fake,
  temperature: 0,
  maxTokens: 128_000,
  // No limit - testing only
};

export const Models: Record<LLMName, LLMConfig> = {
  Opus: OpusConfig,
  Sonnet: SonnetConfig,
  Haiku: HaikuConfig,
  Haiku3: Haiku3Config,
  Gpt5: Gpt5Config,
  Gpt5Mini: Gpt5MiniConfig,
  GptOss: GptOssConfig,
  GeminiFlash: GeminiFlashConfig,
  GroqGptOss120b: GroqGptOss120bConfig,
  Fake: FakeConfig,
};
