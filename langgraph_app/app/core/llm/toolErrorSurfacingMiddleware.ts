/**
 * Tool Error Surfacing Middleware
 *
 * Catches tool execution errors and returns them as ToolMessages so the LLM
 * can see what went wrong and adjust its next call. Without this, any tool
 * error that passes through a wrapToolCall middleware gets classified as a
 * MiddlewareError by LangChain and crashes the agent — the LLM never sees it.
 *
 * This is NOT a retry mechanism. The tool call is attempted once. On failure
 * the error text is surfaced to the LLM, which decides whether to retry with
 * different arguments, skip the operation, or take a different approach.
 *
 * Must be the FIRST middleware in the array so it wraps the outermost layer
 * of the wrapToolCall chain.
 */
import { createMiddleware, type AgentMiddleware } from "langchain";
import { ToolMessage } from "@langchain/core/messages";
import { getLogger } from "@core";

export function createToolErrorSurfacingMiddleware(): AgentMiddleware {
  return createMiddleware({
    name: "tool-error-surfacing",

    wrapToolCall: async (request, handler) => {
      try {
        return await handler(request);
      } catch (error) {
        const toolName = request.toolCall?.name ?? "unknown";
        const message = error instanceof Error ? error.message : String(error);

        getLogger({ component: "toolErrorSurfacing" }).warn(
          { toolName, error: message },
          "Tool error surfaced to LLM"
        );

        return new ToolMessage({
          content: `Error calling ${toolName}: ${message}`,
          tool_call_id: request.toolCall.id!,
          name: toolName,
          status: "error",
        });
      }
    },
  }) as AgentMiddleware;
}
