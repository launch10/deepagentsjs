import type { BaseMessage } from "@langchain/core/messages";
import { db } from "@db";
import {
  llmConversationTraces202601,
  llmConversationTraces202602,
  llmConversationTraces202603,
} from "@db";
import type { TraceContext, UsageSummary } from "./types";
import { serializeMessages } from "./serializeMessages";

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
