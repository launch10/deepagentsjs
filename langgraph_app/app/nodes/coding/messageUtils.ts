import { AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";

/**
 * Sanitize a message array for direct LLM invocation.
 *
 * Handles two categories of orphaned tool artifacts:
 *
 * 1. Orphaned tool_use — AIMessages with tool_calls that are NOT followed by
 *    paired ToolMessages. Stripped to prevent "tool_use without tool_result" errors.
 *
 * 2. Orphaned tool_result — ToolMessages whose preceding AIMessage was removed
 *    (e.g., by compactConversation summarizing old messages). Dropped to prevent
 *    "unexpected tool_use_id in tool_result" errors.
 */
export function sanitizeMessagesForLLM(messages: BaseMessage[]): BaseMessage[] {
  // Pass 1: Identify which tool_call IDs are preserved (AI message with tool_calls
  // that is properly followed by a ToolMessage).
  const preservedToolCallIds = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    if (msg._getType() === "ai" && ((msg as AIMessage).tool_calls?.length ?? 0) > 0) {
      const nextMsg = messages[i + 1];
      if (nextMsg && nextMsg._getType() === "tool") {
        // This AI message's tool_calls are properly paired
        for (const tc of (msg as AIMessage).tool_calls!) {
          preservedToolCallIds.add(tc.id!);
        }
      }
    }
  }

  // Pass 2: Build result, stripping orphaned tool_use and orphaned tool_result.
  const result: BaseMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;

    if (msg._getType() === "ai" && ((msg as AIMessage).tool_calls?.length ?? 0) > 0) {
      const nextMsg = messages[i + 1];
      if (nextMsg && nextMsg._getType() === "tool") {
        // Paired — preserve as-is
        result.push(msg);
      } else {
        // Orphaned tool_use — strip tool artifacts, keep text content
        result.push(stripToolArtifactsFromMessage(msg as AIMessage));
      }
    } else if (msg._getType() === "tool") {
      // Only keep ToolMessages whose tool_call_id has a preserved AI message
      const toolCallId = (msg as ToolMessage).tool_call_id;
      if (toolCallId && preservedToolCallIds.has(toolCallId)) {
        result.push(msg);
      }
      // else: orphaned tool_result — drop silently
    } else {
      result.push(msg);
    }
  }

  return result;
}

/**
 * Strip tool_use content blocks and tool_calls from an AIMessage, preserving text.
 * Used only for orphaned tool_use (no paired ToolMessages) to prevent API errors.
 */
function stripToolArtifactsFromMessage(message: AIMessage): AIMessage {
  const TOOL_BLOCK_TYPES = new Set(["tool_use", "tool_call", "tool_call_chunk"]);

  let cleanContent: typeof message.content;
  if (Array.isArray(message.content)) {
    const filtered = message.content.filter(
      (block: any) => !TOOL_BLOCK_TYPES.has(block.type)
    );
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
      tool_calls: undefined,
    },
    tool_calls: [],
    invalid_tool_calls: [],
  });
}
