// LLM configuration types
// Dynamic config (models, preferences) comes from Rails API

export type LLMProvider = "anthropic" | "openai" | "groq" | "ollama";
export type LLMSkill = "planning" | "writing" | "coding" | "reasoning";
export type LLMSpeed = "blazing" | "fast" | "slow";
export type LLMCost = "free" | "paid";

// Model config from Rails API (snake_case to match Rails conventions)
export interface ModelConfig {
  enabled: boolean;
  max_usage_percent: number | null;
  cost_in: number | null;
  cost_out: number | null;
  cost_reasoning: number | null;
  cache_reads: number | null;
  cache_writes: number | null;
  model_card: string | null;
  provider: LLMProvider | null;
  price_tier: number; // 1=premium, 5=cheap
}

// Full config response from Rails API
export interface ModelConfigurationResponse {
  models: Record<string, ModelConfig>;
  preferences: Record<LLMCost, Record<LLMSpeed, Record<LLMSkill, string[]>>>;
  updated_at: string;
}

// Backwards compatibility alias
export type ModelConfigData = ModelConfig;

// Options for getLLM and getLLMFallbacks
export interface LLMOptions {
  skill?: LLMSkill;
  speed?: LLMSpeed;
  cost?: LLMCost;
  usagePercent?: number;
  maxTier?: number;
}
