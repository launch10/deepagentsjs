import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { BaseMessageLike, BaseMessage, AIMessage, HumanMessage, SystemMessage, Message } from "@langchain/core/messages";
export type { BaseMessageLike, BaseMessage, AIMessage, HumanMessage, SystemMessage, Message, LangGraphRunnableConfig };
interface RecordWithMessages {
    messages: BaseMessage[];
}

export const lastHumanMessage = (record: RecordWithMessages): HumanMessage | undefined => {
  if (!record.messages || record.messages.length === 0) {
    return undefined;
  }
  const humanMessages = record.messages.filter(msg => msg.getType() === "human") as BaseMessage[];
  return humanMessages.at(-1) as HumanMessage;
};

export const lastAIMessage = (record: RecordWithMessages): AIMessage | undefined => {
  if (!record.messages || record.messages.length === 0) {
    return undefined;
  }
  const aiMessages = record.messages.filter(msg => msg.getType() === "ai") as BaseMessage[];
  return aiMessages.at(-1) as AIMessage; 
};

export const countHumanMessages = (record: RecordWithMessages): number => {
  if (!record.messages || record.messages.length === 0) {
    return 0;
  }
  const humanMessages = record.messages.filter(msg => msg.getType() === "human") as BaseMessage[];
  return humanMessages.length;
}

export const isFirstMessage = (record: RecordWithMessages): boolean => {
  if (!record.messages || record.messages.length === 0) {
    return false;
  }
  const humanMessages = record.messages.filter(msg => msg.getType() === "human") as BaseMessage[];
  return humanMessages.length === 1;
}