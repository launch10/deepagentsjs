import type { BaseMessage } from "@langchain/core/messages";
import { isContextMessage } from "langgraph-ai-sdk";
import type { SerializedMessage } from "./types";

/**
 * Serialize messages for storage in JSONB.
 * Preserves all relevant fields and adds is_context_message flag.
 */
export function serializeMessages(messages: BaseMessage[]): SerializedMessage[] {
  return messages.map((msg) => ({
    type: msg._getType(),
    content: msg.content,
    name: (msg as any).name ?? undefined,
    id: msg.id ?? undefined,
    tool_calls: (msg as any).tool_calls ?? undefined,
    tool_call_id: (msg as any).tool_call_id ?? undefined,
    usage_metadata: (msg as any).usage_metadata ?? undefined,
    response_metadata: (msg as any).response_metadata ?? undefined,
    additional_kwargs: (msg as any).additional_kwargs ?? undefined,
    is_context_message: isContextMessage(msg),
  }));
}
