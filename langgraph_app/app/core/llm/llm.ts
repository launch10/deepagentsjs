import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { RunnableBinding, type RunnableConfig } from "@langchain/core/runnables";
import type { LLMSkill, LLMSpeed, LLMCost, LLMOptions } from "./types";
import { LLMManager } from "./service";
import { env } from "@core";
import { usageTracker } from "../billing";

/**
 * Custom RunnableBinding that properly forwards withStructuredOutput to the bound model.
 * This ensures that usage tracking is preserved when using structured output.
 */
class StructuredOutputRunnableBinding<
  RunInput,
  RunOutput,
  CallOptions extends RunnableConfig = RunnableConfig,
> extends RunnableBinding<RunInput, RunOutput, CallOptions> {
  /**
   * Forward withStructuredOutput to the bound model, preserving the RunnableBinding wrapper.
   */
  withStructuredOutput<RunOutput extends Record<string, any> = Record<string, any>>(
    outputSchema: any,

    config?: any
  ): RunnableBinding<RunInput, RunOutput, CallOptions> {
    const boundModel = this.bound as unknown as BaseChatModel;
    if (typeof boundModel.withStructuredOutput !== "function") {
      throw new Error(
        "Bound model does not support withStructuredOutput. " +
          "This may happen with test fixtures that don't implement this method."
      );
    }
    const structuredModel = boundModel.withStructuredOutput(outputSchema, config);

    // Create a new RunnableBinding with the structured model, preserving config factories
    return new StructuredOutputRunnableBinding({
      bound: structuredModel,
      config: this.config,
      configFactories: this.configFactories,
    }) as unknown as RunnableBinding<RunInput, RunOutput, CallOptions>;
  }
}

// Lazy getters for defaults to avoid issues with env not being initialized at module load time
const getSpeedDefault = (): LLMSpeed => (env.LLM_SPEED === "fast" ? "fast" : "slow");
const getCostDefault = (): LLMCost => (env.LLM_PAID === "paid" ? "paid" : "free");
const LLM_SKILL_DEFAULT: LLMSkill = "writing";

/**
 * Get the effective maxTier, combining explicit value with env var.
 * Explicit maxTier takes precedence, then falls back to LLM_MAX_TIER env var.
 * The more restrictive (higher number = cheaper) value wins when both are set.
 *
 * When LLMManager.ignoreEnvMaxTier is true (testing), the env var is ignored
 * and only the explicit maxTier is used.
 */
function getEffectiveMaxTier(explicitMaxTier?: number): number | undefined {
  // In test mode, ignore the env var if explicitly requested
  if (LLMManager.ignoreEnvMaxTier) {
    return explicitMaxTier;
  }

  const envMaxTier = env.LLM_MAX_TIER;

  if (explicitMaxTier !== undefined && envMaxTier !== undefined) {
    // Both set: use the more restrictive (higher = cheaper models only)
    return Math.max(explicitMaxTier, envMaxTier);
  }

  return explicitMaxTier ?? envMaxTier;
}

/**
 * Get an LLM instance based on skill/speed/cost preferences.
 *
 * Models are fetched from Rails API (with Redis caching) and filtered based on:
 * - Enabled status (disabled models are skipped)
 * - Usage thresholds (expensive models excluded as users approach limits)
 * - Price tier (when maxTier is specified, only models at or below that tier are used)
 *
 * In test mode, returns mock responses if configured via LLMManager.configureFixtures().
 *
 * @param options - Configuration options
 * @param options.skill - The skill needed (planning, writing, coding, reasoning). Defaults to "writing".
 * @param options.speed - Speed preference (blazing, fast, slow). Defaults to LLM_SPEED env var.
 * @param options.cost - Cost tier (free or paid). Defaults to LLM_PAID env var.
 * @param options.usagePercent - Current user's usage percentage (0-100). Defaults to 0.
 * @param options.maxTier - Maximum price tier allowed (1=premium only, 5=any tier). Higher tier numbers = cheaper models.
 *                          Combined with LLM_MAX_TIER env var (more restrictive wins).
 */
export async function getLLM(options: LLMOptions = {}): Promise<BaseChatModel> {
  const skill = options.skill ?? LLM_SKILL_DEFAULT;
  const speed = options.speed ?? getSpeedDefault();
  const cost = options.cost ?? getCostDefault();
  const usagePercent = options.usagePercent ?? 0;
  const maxTier = options.maxTier;

  const effectiveMaxTier = getEffectiveMaxTier(maxTier);
  const model = await LLMManager.get(skill, speed, cost, usagePercent, effectiveMaxTier);

  // Attach usage tracking callback using configFactories.
  // This ensures the callback is always included at invoke time, even when
  // LangGraph or createAgent pass their own config with an empty callbacks array.
  // Using configFactories (vs withConfig) survives through bindTools and other
  // RunnableBinding transformations that would otherwise replace callbacks.
  // Uses StructuredOutputRunnableBinding to properly forward withStructuredOutput calls.
  return new StructuredOutputRunnableBinding({
    bound: model,
    config: {},
    configFactories: [
      (config: RunnableConfig) => {
        // Ensure callbacks is always an array before spreading
        const existingCallbacks = Array.isArray(config?.callbacks) ? config.callbacks : [];
        return {
          ...config,
          callbacks: [...existingCallbacks, usageTracker],
        };
      },
    ],
  }) as unknown as BaseChatModel;
}

/**
 * Get an array of LLM instances for fallback chains.
 *
 * Returns models in priority order (first is primary, rest are fallbacks).
 * Only returns models that are enabled and properly configured.
 * Models above the maxTier are filtered out from the fallback chain.
 *
 * @param options - Configuration options
 * @param options.skill - The skill needed (planning, writing, coding, reasoning). Defaults to "writing".
 * @param options.speed - Speed preference (blazing, fast, slow). Defaults to LLM_SPEED env var.
 * @param options.cost - Cost tier (free or paid). Defaults to LLM_PAID env var.
 * @param options.usagePercent - Current user's usage percentage (0-100). Defaults to 0.
 * @param options.maxTier - Maximum price tier allowed (1=premium only, 5=any tier). Higher tier numbers = cheaper models.
 *                          Combined with LLM_MAX_TIER env var (more restrictive wins).
 */
export async function getLLMFallbacks(options: LLMOptions = {}): Promise<BaseChatModel[]> {
  const skill = options.skill ?? LLM_SKILL_DEFAULT;
  const speed = options.speed ?? getSpeedDefault();
  const cost = options.cost ?? getCostDefault();
  const usagePercent = options.usagePercent ?? 0;
  const maxTier = options.maxTier;

  const effectiveMaxTier = getEffectiveMaxTier(maxTier);
  return LLMManager.getFallbacks(skill, speed, cost, usagePercent, effectiveMaxTier);
}

export async function clearLLMCache() {
  return LLMManager.clearCache();
}
