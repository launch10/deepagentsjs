import { type BaseChatModel } from "@langchain/core/language_models/chat_models";
import { type LLMSkill, type LLMSpeed, type LLMCost } from "./types";
import { LLMManager } from "./core";

const LLM_SPEED_DEFAULT: LLMSpeed = (process.env.LLM_SPEED === 'fast') ? "fast" : "slow";
const LLM_COST_DEFAULT: LLMCost = (process.env.LLM_COST === 'paid') ? "paid" : "free";
const LLM_SKILL_DEFAULT: LLMSkill = 'writing';

/**
 * Get an LLM instance based on the current environment
 *
 * Behavior:
 * - In test environment (NODE_ENV=test):
 *   - If mock responses are configured for the current graph/node: Returns FakeListChatModel
 *   - If no mock responses are configured: Falls back to core LLM (real implementation)
 * - In development/production: Always returns core LLM instances (Anthropic, Ollama, etc.)
 *
 * This fallback behavior allows you to:
 * 1. Mock specific nodes in tests while using real LLMs for others
 * 2. Run tests without mocking everything upfront
 * 3. Gradually add mocks as needed
 *
 * @param llmSkill - The skill needed (planning, writing, coding, reasoning)
 * @param llmSpeed - Speed preference (fast or slow), defaults to LLM_SPEED env var
 * @returns BaseChatModel instance
 */
export function getLLM(
  llmSkill: LLMSkill = LLM_SKILL_DEFAULT,
  llmSpeed: LLMSpeed = LLM_SPEED_DEFAULT,
  llmCost: LLMCost = LLM_COST_DEFAULT
): BaseChatModel {
  return LLMManager.get(llmSkill, llmSpeed, llmCost)
}