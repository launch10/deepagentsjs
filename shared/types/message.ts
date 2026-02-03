import { type LangGraphRunnableConfig, MessagesAnnotation } from "@langchain/langgraph";
import { type BaseMessageLike, AIMessage, HumanMessage, SystemMessage, type Message } from "@langchain/core/messages";
import { isContextMessage } from "langgraph-ai-sdk";

/**
 * Derive BaseMessage from LangGraph's MessagesAnnotation to ensure type consistency
 * between our state types and LangGraph's annotation inference.
 */
export type BaseMessage = typeof MessagesAnnotation.State["messages"][number];

export type { BaseMessageLike, AIMessage, HumanMessage, SystemMessage, Message, LangGraphRunnableConfig };
export { isContextMessage };

interface RecordWithMessages {
  messages: BaseMessage[];
}

/**
 * Returns the first human message, excluding context messages.
 * Context messages are system-injected and should not count as user messages.
 */
export const firstHumanMessage = (record: RecordWithMessages): HumanMessage | undefined => {
  if (!record.messages || record.messages.length === 0) {
    return undefined;
  }
  const humanMessages = record.messages.filter(
    msg => HumanMessage.isInstance(msg) && !isContextMessage(msg)
  ) as BaseMessage[];
  return humanMessages.at(0) as HumanMessage;
};

/**
 * Returns the last human message, excluding context messages.
 * Context messages are system-injected and should not count as user messages.
 */
export const lastHumanMessage = (record: RecordWithMessages): HumanMessage | undefined => {
  if (!record.messages || record.messages.length === 0) {
    return undefined;
  }
  const humanMessages = record.messages.filter(
    msg => HumanMessage.isInstance(msg) && !isContextMessage(msg)
  ) as BaseMessage[];
  return humanMessages.at(-1) as HumanMessage;
};

export const lastAIMessage = (record: RecordWithMessages): AIMessage | undefined => {
  if (!record.messages || record.messages.length === 0) {
    return undefined;
  }
  const aiMessages = record.messages.filter(msg => AIMessage.isInstance(msg)) as BaseMessage[];
  return aiMessages.at(-1) as AIMessage;
};

/**
 * Counts human messages, excluding context messages.
 * Context messages are system-injected and should not count as user messages.
 */
export const countHumanMessages = (record: RecordWithMessages): number => {
  if (!record.messages || record.messages.length === 0) {
    return 0;
  }
  const humanMessages = record.messages.filter(
    msg => HumanMessage.isInstance(msg) && !isContextMessage(msg)
  ) as BaseMessage[];
  return humanMessages.length;
}

/**
 * Returns true if this is the first human message, excluding context messages.
 * Context messages are system-injected and should not count as user messages.
 */
export const isFirstMessage = (record: RecordWithMessages): boolean => {
  if (!record.messages || record.messages.length === 0) {
    return false;
  }
  const humanMessages = record.messages.filter(
    msg => HumanMessage.isInstance(msg) && !isContextMessage(msg)
  ) as BaseMessage[];
  return humanMessages.length === 1;
}