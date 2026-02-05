/**
 * Prompt Caching Middleware
 *
 * Adds Anthropic cache_control headers to messages so repeated context
 * (system prompt + early conversation) is cached across turns.
 *
 * Works with wrapped models (StructuredOutputRunnableBinding, ConfigurableModel)
 * by recursively unwrapping to find the underlying ChatAnthropic instance.
 *
 * The built-in anthropicPromptCachingMiddleware in deepagents silently no-ops
 * because it can't see through our RunnableBinding wrapper. This middleware
 * runs alongside it and handles the unwrapping.
 */
import { createMiddleware, type AgentMiddleware } from "langchain";

function isAnthropicModel(model: any): boolean {
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

export function createPromptCachingMiddleware(options?: {
  ttl?: "5m" | "1h";
  minMessagesToCache?: number;
}): AgentMiddleware {
  const ttl = options?.ttl ?? "5m";
  const minMessages = options?.minMessagesToCache ?? 3;

  return createMiddleware({
    name: "AnthropicPromptCachingMiddleware",
    wrapModelCall: (request: any, handler: any) => {
      if (!isAnthropicModel(request.model)) return handler(request);

      const messagesCount =
        request.state.messages.length + (request.systemPrompt ? 1 : 0);
      if (messagesCount < minMessages) return handler(request);

      const lastMessage = request.messages.at(-1);
      if (!lastMessage) return handler(request);

      const Ctor = Object.getPrototypeOf(lastMessage).constructor;

      if (Array.isArray(lastMessage.content)) {
        const newMessage = new Ctor({
          ...lastMessage,
          content: [
            ...lastMessage.content.slice(0, -1),
            {
              ...lastMessage.content.at(-1),
              cache_control: { type: "ephemeral", ttl },
            },
          ],
        });
        return handler({
          ...request,
          messages: [...request.messages.slice(0, -1), newMessage],
        });
      }

      if (typeof lastMessage.content === "string") {
        const newMessage = new Ctor({
          ...lastMessage,
          content: [
            {
              type: "text",
              text: lastMessage.content,
              cache_control: { type: "ephemeral", ttl },
            },
          ],
        });
        return handler({
          ...request,
          messages: [...request.messages.slice(0, -1), newMessage],
        });
      }

      return handler(request);
    },
  }) as AgentMiddleware;
}
