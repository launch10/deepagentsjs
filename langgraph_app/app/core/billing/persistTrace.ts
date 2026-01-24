import type { BaseMessage } from "@langchain/core/messages";
import { isContextMessage } from "langgraph-ai-sdk";
import { db } from "@db";
import {
  llmConversationTraces202601,
  llmConversationTraces202602,
  llmConversationTraces202603,
} from "@db";

/**
 * Context for persisting a conversation trace.
 */
export interface TraceContext {
  chatId: number;
  threadId: string;
  runId: string;
  graphName?: string;
}

/**
 * Usage summary for the trace.
 */
export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  llmCallCount: number;
  totalCostMicrocents?: number;
}

/**
 * Serialized message format for storage in JSONB.
 */
export interface SerializedMessage {
  type: string;
  content: unknown;
  name?: string;
  id?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
  usage_metadata?: unknown;
  response_metadata?: unknown;
  additional_kwargs?: unknown;
  /** Flag for easy SQL filtering of context messages */
  is_context_message: boolean;
}

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

/**
 * Get the appropriate partition table based on current date.
 */
function getPartitionTable() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-indexed

  // Map month to partition table
  // TODO: Make this dynamic or handle partition creation
  switch (month) {
    case 1:
      return llmConversationTraces202601;
    case 2:
      return llmConversationTraces202602;
    case 3:
      return llmConversationTraces202603;
    default:
      // Fallback to current month's partition or January
      // In production, partitions should be created ahead of time
      return llmConversationTraces202601;
  }
}

/**
 * Persist a conversation trace to the database.
 *
 * @param context - Trace metadata (chatId, threadId, runId, graphName)
 * @param messages - Ordered array of all messages in the conversation
 * @param usageSummary - Aggregated usage statistics
 */
export async function persistTrace(
  context: TraceContext,
  messages: BaseMessage[],
  usageSummary: UsageSummary
): Promise<void> {
  // Don't write empty traces
  if (messages.length === 0) {
    return;
  }

  const serializedMessages = serializeMessages(messages);

  // Extract system prompt from first SystemMessage for convenience column
  const systemMessage = messages.find((m) => m._getType() === "system");
  const systemPrompt = systemMessage
    ? typeof systemMessage.content === "string"
      ? systemMessage.content
      : JSON.stringify(systemMessage.content)
    : null;

  const table = getPartitionTable();

  await db.insert(table).values({
    chatId: context.chatId,
    threadId: context.threadId,
    runId: context.runId,
    graphName: context.graphName ?? null,
    messages: serializedMessages,
    systemPrompt,
    usageSummary,
    createdAt: new Date().toISOString(),
  });
}
