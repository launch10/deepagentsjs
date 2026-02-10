import { AIMessage, type BaseMessage } from "@langchain/core/messages";

/**
 * Strip tool_use / tool_call content blocks and metadata from an AIMessage.
 *
 * The full coding agent (deepagents) produces AI messages with tool_use blocks
 * from its ReAct tool loop. These are internal artifacts that must not leak into
 * graph state — if they do, subsequent LLM calls (e.g. singleShotEdit) crash with
 * "tool_use ids were found without tool_result blocks immediately after".
 */
export function stripToolArtifacts(message: AIMessage): AIMessage {
  // Filter content blocks: keep text, image, reasoning — drop tool_use/tool_call/tool_call_chunk
  const TOOL_BLOCK_TYPES = new Set(["tool_use", "tool_call", "tool_call_chunk"]);

  let cleanContent: typeof message.content;
  if (Array.isArray(message.content)) {
    const filtered = message.content.filter(
      (block: any) => !TOOL_BLOCK_TYPES.has(block.type)
    );
    // If all blocks were tool artifacts, fall back to empty string
    cleanContent = filtered.length > 0 ? filtered : "";
  } else {
    cleanContent = message.content;
  }

  return new AIMessage({
    content: cleanContent,
    id: message.id,
    name: message.name,
    response_metadata: message.response_metadata,
    additional_kwargs: {
      ...message.additional_kwargs,
      // Clear any tool_calls stashed in additional_kwargs by some providers
      tool_calls: undefined,
    },
    // Clear tool call arrays — these are agent-internal artifacts
    tool_calls: [],
    invalid_tool_calls: [],
  });
}

/**
 * Sanitize a message array for direct LLM invocation.
 *
 * - Strips tool_use content blocks from AIMessages
 * - Removes ToolMessages entirely (artifacts from prior agent runs)
 *
 * Defensive layer: protects against any message source producing dirty history.
 */
export function sanitizeMessagesForLLM(messages: BaseMessage[]): BaseMessage[] {
  return messages
    .filter((msg) => msg._getType() !== "tool")
    .map((msg) => {
      if (msg._getType() === "ai") {
        return stripToolArtifacts(msg as AIMessage);
      }
      return msg;
    });
}
