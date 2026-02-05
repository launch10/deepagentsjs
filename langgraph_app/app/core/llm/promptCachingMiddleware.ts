/**
 * Prompt Caching Middleware
 *
 * Adds Anthropic cache_control breakpoints to both the system prompt and
 * the last message, enabling two-tier caching:
 *
 * 1. System prompt breakpoint — cached independently across conversations.
 *    The ~11K system prompt is reused even when messages differ (e.g. across
 *    subagent invocations or separate user requests). Cache reads cost 10%
 *    of the base input token price.
 *
 * 2. Last-message breakpoint — caches the growing conversation prefix within
 *    a single conversation, so each new turn only processes the delta.
 *
 * Works with wrapped models (StructuredOutputRunnableBinding, ConfigurableModel)
 * by recursively unwrapping to find the underlying ChatAnthropic instance.
 *
 * The built-in anthropicPromptCachingMiddleware in deepagents silently no-ops
 * because it can't see through our RunnableBinding wrapper. This middleware
 * runs alongside it and handles the unwrapping.
 */
import { createMiddleware, SystemMessage, type AgentMiddleware } from "langchain";

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

const cacheBreakpoint = (ttl: string) => ({ type: "ephemeral" as const, ttl });

/**
 * Add cache_control to the last content block of a SystemMessage.
 * Returns a new SystemMessage (immutable) or the original if nothing to do.
 */
function cacheSystemMessage(
  systemMessage: any,
  ttl: string
): any {
  if (!systemMessage) return systemMessage;

  const content = systemMessage.content;

  // Content is an array of blocks — add cache_control to the last block
  if (Array.isArray(content) && content.length > 0) {
    return new SystemMessage({
      ...systemMessage,
      content: [
        ...content.slice(0, -1),
        { ...content.at(-1), cache_control: cacheBreakpoint(ttl) },
      ],
    });
  }

  // Content is a plain string — convert to a content block with cache_control
  if (typeof content === "string" && content.length > 0) {
    return new SystemMessage({
      ...systemMessage,
      content: [
        { type: "text", text: content, cache_control: cacheBreakpoint(ttl) },
      ],
    });
  }

  return systemMessage;
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

      // Breakpoint 1: Cache the system prompt independently.
      // This allows the ~11K system prompt to be reused across subagent
      // invocations and separate user requests, even when messages differ.
      const cachedSystemMessage = cacheSystemMessage(
        request.systemMessage,
        ttl
      );

      // Breakpoint 2: Cache the conversation prefix (last message).
      // Within a single conversation, each new turn only processes the delta.
      const lastMessage = request.messages.at(-1);
      if (!lastMessage) {
        return handler({
          ...request,
          systemMessage: cachedSystemMessage,
        });
      }

      const Ctor = Object.getPrototypeOf(lastMessage).constructor;

      if (Array.isArray(lastMessage.content)) {
        const newMessage = new Ctor({
          ...lastMessage,
          content: [
            ...lastMessage.content.slice(0, -1),
            {
              ...lastMessage.content.at(-1),
              cache_control: cacheBreakpoint(ttl),
            },
          ],
        });
        return handler({
          ...request,
          systemMessage: cachedSystemMessage,
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
              cache_control: cacheBreakpoint(ttl),
            },
          ],
        });
        return handler({
          ...request,
          systemMessage: cachedSystemMessage,
          messages: [...request.messages.slice(0, -1), newMessage],
        });
      }

      return handler({
        ...request,
        systemMessage: cachedSystemMessage,
      });
    },
  }) as AgentMiddleware;
}
