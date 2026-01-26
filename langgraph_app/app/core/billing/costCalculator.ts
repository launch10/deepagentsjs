/**
 * Cost Calculator for Langgraph
 *
 * Calculates the cost in millicredits for usage records.
 * This mirrors the Rails Credits::CostCalculator for predictive cost calculation.
 *
 * Formula: millicredits = tokens × price_per_million / 10
 *
 * Where:
 * - price_per_million is the cost in dollars per million tokens
 * - 1 millicredit = 0.001 credits = 0.001 cents = $0.00001
 * - 1 credit = 1000 millicredits = 1 cent
 *
 * Example verification:
 *   100 Haiku input tokens at $1/M:
 *   - Actual cost: 100 × $1/1,000,000 = $0.0001 = 0.01 cents
 *   - Formula: 100 × 1 / 10 = 10 millicredits
 *   - 10 millicredits = 10/1000 credits = 0.01 credits = 0.01 cents ✓
 */

import type { UsageRecord } from "./types";
import type { ModelConfig } from "@core/llm/types";

/**
 * Calculate the cost in millicredits for a single usage record.
 *
 * @param record - The usage record with token counts
 * @param configs - Map of model card name to model config
 * @returns Cost in millicredits (rounded to nearest integer), or 0 if model unknown
 */
export function calculateCost(
  record: UsageRecord,
  configs: Record<string, ModelConfig>
): number {
  const config = findModelConfig(record.model, configs);

  if (!config) {
    // Graceful degradation: log warning and return 0 for unknown models
    console.warn(
      `[costCalculator] Unknown model: ${record.model}. Returning 0 cost.`
    );
    return 0;
  }

  let cost = 0;

  // Input tokens
  cost += tokenCost(record.inputTokens, config.costIn);

  // Output tokens
  cost += tokenCost(record.outputTokens, config.costOut);

  // Reasoning tokens - fall back to output cost if reasoning cost not specified
  const reasoningRate = config.costReasoning ?? config.costOut;
  cost += tokenCost(record.reasoningTokens, reasoningRate);

  // Cache write tokens
  cost += tokenCost(record.cacheCreationTokens, config.cacheWrites);

  // Cache read tokens
  cost += tokenCost(record.cacheReadTokens, config.cacheReads);

  // Round to nearest millicredit
  return Math.round(cost);
}

/**
 * Calculate the total cost in millicredits for multiple usage records.
 *
 * @param records - Array of usage records
 * @param configs - Map of model card name to model config
 * @returns Total cost in millicredits
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
function findModelConfig(
  modelName: string,
  configs: Record<string, ModelConfig>
): ModelConfig | undefined {
  // First try exact match
  if (configs[modelName]) {
    return configs[modelName];
  }

  // Try to find a config whose modelCard matches
  for (const config of Object.values(configs)) {
    if (config.modelCard === modelName) {
      return config;
    }
  }

  // Try prefix matching (e.g., "claude-haiku-4-5-20251001" might match config for "claude-haiku-4-5")
  for (const config of Object.values(configs)) {
    if (config.modelCard && modelName.startsWith(config.modelCard)) {
      return config;
    }
  }

  return undefined;
}
