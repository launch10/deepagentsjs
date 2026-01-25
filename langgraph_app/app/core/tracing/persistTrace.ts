import type { BaseMessage } from "@langchain/core/messages";
import { db, llmConversationTraces } from "@db";
import type { TraceContext, UsageSummary } from "./types";
import { serializeMessages } from "./serializeMessages";

/**
 * Persist a conversation trace to the database.
 *
 * Writes to the parent partitioned table (llm_conversation_traces).
 * PostgreSQL automatically routes to the correct monthly partition based on created_at.
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

  await db.insert(llmConversationTraces).values({
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
