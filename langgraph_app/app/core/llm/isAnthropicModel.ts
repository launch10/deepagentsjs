/**
 * Detect whether a model (which may be wrapped in RunnableBindings,
 * ConfigurableModel, etc.) is ultimately a ChatAnthropic instance.
 *
 * Used by middleware that needs to branch on provider — e.g. prompt caching
 * (Anthropic-only cache_control) and native tool injection (text_editor).
 */
export function isAnthropicModel(model: any): boolean {
  if (!model) return false;

  const name: string | undefined = model.getName?.();
  if (name === "ChatAnthropic") return true;

  if (name === "ConfigurableModel") {
    if (model._defaultConfig?.modelProvider === "anthropic") return true;
    if (
      typeof model._defaultConfig?.model === "string" &&
      model._defaultConfig.model.startsWith("claude")
    )
      return true;
    for (const instance of model._modelInstanceCache?.values?.() ?? []) {
      if (isAnthropicModel(instance)) return true;
    }
    return false;
  }

  // RunnableBinding / StructuredOutputRunnableBinding — unwrap
  if (model.bound) return isAnthropicModel(model.bound);
  if (model.first) return isAnthropicModel(model.first);

  return false;
}
