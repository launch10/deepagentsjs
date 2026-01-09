import { LLMManagerFactory } from "./factory";
import {
  type LLMAppConfig,
  type LLMFallbackAppConfig,
  OpusConfig,
  SonnetConfig,
  HaikuConfig,
  Haiku3Config,
  GptOssConfig,
  Gpt5Config,
  Gpt5MiniConfig,
  GroqGptOss120bConfig,
} from "./types";

export const coreLLMConfig: LLMAppConfig = {
  free: {
    blazing: {
      planning: GptOssConfig,
      writing: GptOssConfig,
      coding: GptOssConfig,
      reasoning: GptOssConfig,
    },
    fast: {
      planning: GptOssConfig,
      writing: GptOssConfig,
      coding: GptOssConfig,
      reasoning: GptOssConfig,
    },
    slow: {
      planning: GptOssConfig,
      writing: GptOssConfig,
      coding: GptOssConfig,
      reasoning: GptOssConfig,
    },
  },
  paid: {
    blazing: {
      planning: GroqGptOss120bConfig,
      writing: GroqGptOss120bConfig,
      coding: GroqGptOss120bConfig,
      reasoning: GroqGptOss120bConfig,
    },
    fast: {
      planning: SonnetConfig,
      writing: HaikuConfig,
      coding: HaikuConfig,
      reasoning: HaikuConfig,
    },
    slow: {
      planning: SonnetConfig,
      writing: HaikuConfig,
      coding: SonnetConfig,
      reasoning: SonnetConfig,
    },
  },
};

// Fallback chains: ordered from highest quality to lowest
// First model is primary, rest are fallbacks in priority order
//
// Usage thresholds are now defined on each model config's maxUsagePercent:
// - OpusConfig: maxUsagePercent: 80 (most expensive - cut first)
// - SonnetConfig: maxUsagePercent: 90
// - HaikuConfig: maxUsagePercent: 95
// - Others: no limit (always available)
//
// As user approaches their monthly limit, more expensive models are
// automatically filtered out based on their maxUsagePercent.
export const coreLLMFallbackConfig: LLMFallbackAppConfig = {
  free: {
    blazing: {
      planning: [GptOssConfig],
      writing: [GptOssConfig],
      coding: [GptOssConfig],
      reasoning: [GptOssConfig],
    },
    fast: {
      planning: [GptOssConfig],
      writing: [GptOssConfig],
      coding: [GptOssConfig],
      reasoning: [GptOssConfig],
    },
    slow: {
      planning: [GptOssConfig],
      writing: [GptOssConfig],
      coding: [GptOssConfig],
      reasoning: [GptOssConfig],
    },
  },
  paid: {
    blazing: {
      // Speed is priority
      planning: [GroqGptOss120bConfig, HaikuConfig, Haiku3Config],
      writing: [GroqGptOss120bConfig, HaikuConfig, Haiku3Config],
      coding: [GroqGptOss120bConfig, HaikuConfig, Haiku3Config],
      reasoning: [GroqGptOss120bConfig, HaikuConfig, Haiku3Config],
    },
    fast: {
      // Fast models first
      planning: [SonnetConfig, HaikuConfig, Gpt5Config],
      writing: [HaikuConfig, Haiku3Config, Gpt5MiniConfig],
      coding: [HaikuConfig, SonnetConfig, Gpt5Config],
      reasoning: [HaikuConfig, SonnetConfig, Gpt5Config],
    },
    slow: {
      // Quality is priority
      // Usage thresholds from model configs:
      // - Opus: 80%, Sonnet: 90%, Haiku: 95%, Gpt5: 100%
      planning: [OpusConfig, SonnetConfig, HaikuConfig, Gpt5Config],
      writing: [SonnetConfig, HaikuConfig, Gpt5Config],
      coding: [OpusConfig, SonnetConfig, HaikuConfig, Gpt5Config],
      reasoning: [OpusConfig, SonnetConfig, HaikuConfig, Gpt5Config],
    },
  },
};

export const LLMManager = new LLMManagerFactory(coreLLMConfig, coreLLMFallbackConfig);
