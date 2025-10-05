import { BaseMessage } from "@langchain/core/messages";
interface RecordWithMessages {
    messages: BaseMessage[];
}

export const lastHumanMessage = (record: RecordWithMessages): BaseMessage | undefined => {
  if (!record.messages || record.messages.length === 0) {
    return undefined;
  }
  const humanMessages = record.messages.filter(msg => msg.getType() === "human") as BaseMessage[];
  return humanMessages[humanMessages.length - 1];
};

export const lastAIMessage = (record: RecordWithMessages): BaseMessage | undefined => {
  if (!record.messages || record.messages.length === 0) {
    return undefined;
  }
  const aiMessages = record.messages.filter(msg => msg.getType() === "ai") as BaseMessage[];
  return aiMessages[aiMessages.length - 1];
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