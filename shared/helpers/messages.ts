import { isHumanMessage, type BaseMessage } from "@langchain/core/messages";

export type RecordWithMessages = {
  messages?: BaseMessage[];
};

export const isFirstMessage = (record: RecordWithMessages): boolean => {
  if (!record.messages || record.messages.length === 0) {
    return false;
  }
  const humanMessages = record.messages.filter(isHumanMessage) as BaseMessage[];
  return humanMessages.length === 1;
};
