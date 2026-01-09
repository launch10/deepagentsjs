import { type BaseChatModel } from "@langchain/core/language_models/chat_models";
import { type LLMSkill, type LLMSpeed, type LLMCost } from "./types";
import { LLMManager } from "./core";

const LLM_SPEED_DEFAULT: LLMSpeed = process.env.LLM_SPEED === "fast" ? "fast" : "slow";
const LLM_COST_DEFAULT: LLMCost = process.env.LLM_PAID === "paid" ? "paid" : "free";
const LLM_SKILL_DEFAULT: LLMSkill = "writing";

/**
 * Get an LLM instance based on the current environment
 *
 * Behavior:
 * - In test environment (NODE_ENV=test):
 *   - If mock responses are configured for the current graph/node: Returns FakeListChatModel
 *   - If no mock responses are configured: Falls back to core LLM (real implementation)
 * - In development/production: Always returns core LLM instances (Anthropic, Ollama, etc.)
 *
 * Models are filtered based on the user's current usage percentage - more expensive
 * models are excluded as users approach their limits.
 *
 * This fallback behavior allows you to:
 * 1. Mock specific nodes in tests while using real LLMs for others
 * 2. Run tests without mocking everything upfront
 * 3. Gradually add mocks as needed
 *
 * @param llmSkill - The skill needed (planning, writing, coding, reasoning)
 * @param llmSpeed - Speed preference (fast or slow), defaults to LLM_SPEED env var
 * @param llmCost - Cost tier (free or paid), defaults to LLM_PAID env var
 * @param usagePercent - Current user's usage percentage (0-100). Defaults to 0 (all models available).
 * @returns BaseChatModel instance
 */
export function getLLM(
  llmSkill: LLMSkill = LLM_SKILL_DEFAULT,
  llmSpeed: LLMSpeed = LLM_SPEED_DEFAULT,
  llmCost: LLMCost = LLM_COST_DEFAULT,
  usagePercent: number = 0
): BaseChatModel {
  return LLMManager.get(llmSkill, llmSpeed, llmCost, usagePercent);
}

/**
 * Get an array of LLM instances for fallback chains
 *
 * Returns models in priority order:
 * - First model is the primary (highest quality/preferred)
 * - Subsequent models are fallbacks in case of rate limits, errors, or availability issues
 *
 * Only returns models that are properly configured (have valid API keys, etc.)
 * Models are filtered based on the user's current usage percentage - more expensive
 * models are excluded as users approach their limits.
 *
 * Example usage with middleware:
 * ```typescript
 * const fallbacks = getLLMFallbacks("coding", "slow", "paid", 75);
 * const modelFallbackMiddleware = modelFallbackMiddlewareBuilder(...fallbacks);
 * ```
 *
 * @param llmSkill - The skill needed (planning, writing, coding, reasoning)
 * @param llmSpeed - Speed preference (fast or slow), defaults to LLM_SPEED env var
 * @param llmCost - Cost tier (free or paid), defaults to LLM_PAID env var
 * @param usagePercent - Current user's usage percentage (0-100). Defaults to 0 (all models available).
 * @returns Array of BaseChatModel instances in priority order
 */
export function getLLMFallbacks(
  llmSkill: LLMSkill = LLM_SKILL_DEFAULT,
  llmSpeed: LLMSpeed = LLM_SPEED_DEFAULT,
  llmCost: LLMCost = LLM_COST_DEFAULT,
  usagePercent: number = 0
): BaseChatModel[] {
  return LLMManager.getFallbacks(llmSkill, llmSpeed, llmCost, usagePercent);
}
