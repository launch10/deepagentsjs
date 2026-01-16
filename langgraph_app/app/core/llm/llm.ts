import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { LLMSkill, LLMSpeed, LLMCost } from "./types";
import { LLMManager } from "./service";

const LLM_SPEED_DEFAULT: LLMSpeed = process.env.LLM_SPEED === "fast" ? "fast" : "slow";
const LLM_COST_DEFAULT: LLMCost = process.env.LLM_PAID === "paid" ? "paid" : "free";
const LLM_SKILL_DEFAULT: LLMSkill = "writing";

/**
 * Get an LLM instance based on skill/speed/cost preferences.
 *
 * Models are fetched from Rails API (with Redis caching) and filtered based on:
 * - Enabled status (disabled models are skipped)
 * - Usage thresholds (expensive models excluded as users approach limits)
 *
 * In test mode, returns mock responses if configured via LLMManager.configureFixtures().
 *
 * @param llmSkill - The skill needed (planning, writing, coding, reasoning)
 * @param llmSpeed - Speed preference (blazing, fast, slow), defaults to LLM_SPEED env var
 * @param llmCost - Cost tier (free or paid), defaults to LLM_PAID env var
 * @param usagePercent - Current user's usage percentage (0-100). Defaults to 0.
 */
export async function getLLM(
  llmSkill: LLMSkill = LLM_SKILL_DEFAULT,
  llmSpeed: LLMSpeed = LLM_SPEED_DEFAULT,
  llmCost: LLMCost = LLM_COST_DEFAULT,
  usagePercent: number = 0
): Promise<BaseChatModel> {
  return LLMManager.get(llmSkill, llmSpeed, llmCost, usagePercent);
}

/**
 * Get an array of LLM instances for fallback chains.
 *
 * Returns models in priority order (first is primary, rest are fallbacks).
 * Only returns models that are enabled and properly configured.
 *
 * @param llmSkill - The skill needed (planning, writing, coding, reasoning)
 * @param llmSpeed - Speed preference (blazing, fast, slow), defaults to LLM_SPEED env var
 * @param llmCost - Cost tier (free or paid), defaults to LLM_PAID env var
 * @param usagePercent - Current user's usage percentage (0-100). Defaults to 0.
 */
export async function getLLMFallbacks(
  llmSkill: LLMSkill = LLM_SKILL_DEFAULT,
  llmSpeed: LLMSpeed = LLM_SPEED_DEFAULT,
  llmCost: LLMCost = LLM_COST_DEFAULT,
  usagePercent: number = 0
): Promise<BaseChatModel[]> {
  return LLMManager.getFallbacks(llmSkill, llmSpeed, llmCost, usagePercent);
}
