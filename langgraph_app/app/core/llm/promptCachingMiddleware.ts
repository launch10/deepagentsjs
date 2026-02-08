/**
 * Prompt Caching Middleware
 *
 * Adds Anthropic cache_control breakpoints to the system prompt, tool
 * definitions, and the last message, enabling three-tier caching:
 *
 * 1. System prompt breakpoint — cached independently across conversations.
 *    The ~11K system prompt is reused even when messages differ (e.g. across
 *    subagent invocations or separate user requests). Cache reads cost 10%
 *    of the base input token price.
 *
 * 2. Tools breakpoint — caches tool definitions (system + tools prefix).
 *    Tool schemas are static across turns, so marking the last tool caches
 *    the entire tool array alongside the system prompt.
 *
 * 3. Last-message breakpoint — caches the growing conversation prefix within
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
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { isInteropZodSchema } from "@langchain/core/utils/types";
import { isAnthropicModel } from "./isAnthropicModel";

const cacheBreakpoint = (ttl: string) => ({ type: "ephemeral" as const, ttl });

/**
 * Add cache_control to the last content block of a SystemMessage.
 * Returns a new SystemMessage (immutable) or the original if nothing to do.
 */
function cacheSystemMessage(systemMessage: any, ttl: string): any {
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
      content: [{ type: "text", text: content, cache_control: cacheBreakpoint(ttl) }],
    });
  }

  return systemMessage;
}

/**
 * Add cache_control to the last tool definition.
 *
 * The Anthropic API caches everything up to and including each breakpoint.
 * Marking the last tool caches the entire tools array (plus system prompt).
 *
 * ChatAnthropic's formatStructuredToolToAnthropic() passes through tools
 * that are already in Anthropic format (have `input_schema`) or builtin
 * format unchanged, preserving cache_control. LangChain tools get converted
 * and lose extra properties, so we pre-convert the last one here.
 */
function cacheTools(tools: any[], ttl: string): any[] {
  if (!tools?.length) return tools;

  const lastTool = tools[tools.length - 1];
  const cc = cacheBreakpoint(ttl);

  // Anthropic-format tool (has input_schema) — pass through with cache_control
  if ("input_schema" in lastTool) {
    return [...tools.slice(0, -1), { ...lastTool, cache_control: cc }];
  }

  // Builtin tool (text_editor_*, computer_*, bash_*, web_search_*)
  const builtinPrefixes = ["text_editor_", "computer_", "bash_", "web_search_"];
  if (
    "type" in lastTool &&
    typeof lastTool.type === "string" &&
    builtinPrefixes.some((p) => lastTool.type.startsWith(p))
  ) {
    return [...tools.slice(0, -1), { ...lastTool, cache_control: cc }];
  }

  // LangChain tool (has .name + .schema) — convert to Anthropic format
  if ("name" in lastTool && "schema" in lastTool) {
    const inputSchema = isInteropZodSchema(lastTool.schema)
      ? toJsonSchema(lastTool.schema)
      : lastTool.schema;
    return [
      ...tools.slice(0, -1),
      {
        name: lastTool.name,
        description: lastTool.description || "",
        input_schema: inputSchema,
        cache_control: cc,
      },
    ];
  }

  return tools;
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

      const messagesCount = request.state.messages.length + (request.systemPrompt ? 1 : 0);
      if (messagesCount < minMessages) return handler(request);

      // Breakpoint 1: Cache the system prompt independently.
      // This allows the ~11K system prompt to be reused across subagent
      // invocations and separate user requests, even when messages differ.
      const cachedSystemMessage = cacheSystemMessage(request.systemMessage, ttl);

      // Breakpoint 2: Cache tool definitions (system + tools prefix).
      // Tool schemas are static across turns, so this breakpoint lets the
      // API skip re-processing them on every agent loop iteration.
      const cachedTools = cacheTools(request.tools, ttl);

      // Breakpoint 3: Cache the conversation prefix (last message).
      // Within a single conversation, each new turn only processes the delta.
      const lastMessage = request.messages.at(-1);
      if (!lastMessage) {
        return handler({
          ...request,
          systemMessage: cachedSystemMessage,
          tools: cachedTools,
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
          tools: cachedTools,
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
          tools: cachedTools,
          messages: [...request.messages.slice(0, -1), newMessage],
        });
      }

      return handler({
        ...request,
        systemMessage: cachedSystemMessage,
        tools: cachedTools,
      });
    },
  }) as AgentMiddleware;
}
