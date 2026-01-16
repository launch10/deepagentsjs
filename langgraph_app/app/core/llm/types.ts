// LLM configuration types
// Dynamic config (models, preferences) comes from Rails API

export type LLMProvider = "anthropic" | "openai" | "groq" | "ollama";
export type LLMSkill = "planning" | "writing" | "coding" | "reasoning";
export type LLMSpeed = "blazing" | "fast" | "slow";
export type LLMCost = "free" | "paid";

// Model config from Rails API
export interface ModelConfig {
  enabled: boolean;
  maxUsagePercent: number | null;
  costIn: number | null;
  costOut: number | null;
  modelCard: string | null;
  provider: LLMProvider | null;
}

// Full config response from Rails API
export interface ModelConfigurationResponse {
  models: Record<string, ModelConfig>;
  preferences: Record<LLMCost, Record<LLMSpeed, Record<LLMSkill, string[]>>>;
  updatedAt: string;
}

// Backwards compatibility alias
export type ModelConfigData = ModelConfig;
