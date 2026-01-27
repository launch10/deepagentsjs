/**
 * Cost Calculator for LLM Usage
 *
 * Calculates the cost in millicredits for usage records.
 * This mirrors the Rails Credits::CostCalculator for predictive cost calculation.
 *
 * Credit System:
 *   - 1 credit = 1 cent = $0.01
 *   - 1 millicredit = 1/1000 credit = $0.00001
 *   - $1.00 = 100 credits = 100,000 millicredits
 *
 * Formula Derivation:
 *   cost_in_dollars = tokens × price_per_million / 1,000,000
 *   cost_in_millicredits = cost_in_dollars × 100,000 (since $1 = 100,000 millicredits)
 *   Simplifying: millicredits = tokens × price_per_million / 10
 *
 * Example: 1M tokens at $1/M
 *   - Cost: $1.00 = 100 cents = 100 credits = 100,000 millicredits
 *   - Formula: 1,000,000 × 1 / 10 = 100,000 millicredits ✓
 */

import type { UsageRecord } from "../billing/types";
import type { ModelConfig } from "./types";

/**
 * Error thrown when cost is requested for a model with no cost configuration.
 * With the LLM selection layer guaranteeing costed models, an unknown model
 * at calculation time is a bug.
 */
export class UnknownModelCostError extends Error {
  public readonly modelName: string;

  constructor(modelName: string) {
    super(`Unknown model: ${modelName}. No cost configuration found.`);
    this.name = "UnknownModelCostError";
    this.modelName = modelName;
  }
}

/**
 * Check whether a model config has valid cost configuration.
 * A model is considered costed if at least one of cost_in or cost_out is > 0.
 * Every LLM call produces input or output tokens, so if neither has a rate, cost is always 0.
 */
export function hasValidCostConfig(config: ModelConfig): boolean {
  const hasCostIn = config.cost_in !== null && config.cost_in > 0;
  const hasCostOut = config.cost_out !== null && config.cost_out > 0;
  return hasCostIn || hasCostOut;
}

/**
 * Calculate the cost in millicredits for a single usage record.
 *
 * @param record - The usage record with token counts
 * @param configs - Map of model card name to model config
 * @returns Cost in millicredits (rounded to nearest integer)
 * @throws UnknownModelCostError if model is not found in configs
 */
export function calculateCost(
  record: UsageRecord,
  configs: Record<string, ModelConfig>
): number {
  const config = findModelConfig(record.model, configs);

  if (!config) {
    throw new UnknownModelCostError(record.model);
  }

  let cost = 0;

  // Input tokens
  cost += tokenCost(record.inputTokens, config.cost_in);

  // Output tokens
  cost += tokenCost(record.outputTokens, config.cost_out);

  // Reasoning tokens - fall back to output cost if reasoning cost not specified
  const reasoningRate = config.cost_reasoning ?? config.cost_out;
  cost += tokenCost(record.reasoningTokens, reasoningRate);

  // Cache write tokens
  cost += tokenCost(record.cacheCreationTokens, config.cache_writes);

  // Cache read tokens
  cost += tokenCost(record.cacheReadTokens, config.cache_reads);

  // Round to nearest millicredit
  return Math.round(cost);
}

/**
 * Calculate the total cost in millicredits for multiple usage records.
 *
 * @param records - Array of usage records
 * @param configs - Map of model card name to model config
 * @returns Total cost in millicredits
 * @throws UnknownModelCostError if any model is not found in configs
 */
export function calculateRunCost(
  records: UsageRecord[],
  configs: Record<string, ModelConfig>
): number {
  if (records.length === 0) {
    return 0;
  }

  let totalCost = 0;
  for (const record of records) {
    totalCost += calculateCost(record, configs);
  }

  return totalCost;
}

/**
 * Calculate cost for a token type.
 *
 * @param tokens - Number of tokens
 * @param rate - Cost per million tokens (dollars)
 * @returns Cost in millicredits (not yet rounded)
 */
function tokenCost(tokens: number, rate: number | null): number {
  if (!tokens || tokens === 0) {
    return 0;
  }
  if (!rate || rate === 0) {
    return 0;
  }

  // Formula: tokens × price_per_million / 10
  return tokens * rate / 10;
}

/**
 * Find the model config for a given model name.
 * Handles exact matches and model normalization.
 *
 * @param modelName - The model name from usage record
 * @param configs - Map of model card name to model config
 * @returns The model config or undefined if not found
 */
export function findModelConfig(
  modelName: string,
  configs: Record<string, ModelConfig>
): ModelConfig | undefined {
  // First try exact match
  if (configs[modelName]) {
    return configs[modelName];
  }

  // Try to find a config whose model_card matches
  for (const config of Object.values(configs)) {
    if (config.model_card === modelName) {
      return config;
    }
  }

  // Try prefix matching (e.g., "claude-haiku-4-5-20251001" might match config for "claude-haiku-4-5")
  for (const config of Object.values(configs)) {
    if (config.model_card && modelName.startsWith(config.model_card)) {
      return config;
    }
  }

  return undefined;
}
