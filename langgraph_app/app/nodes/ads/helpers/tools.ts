import { type AdsGraphState } from "@state";
import { HumanMessage } from "@langchain/core/messages";
import { isContextMessage } from "langgraph-ai-sdk";
import { adsFaqTool } from "@tools";

export const getTools = (state: AdsGraphState) => {
  const tools: any[] = [];
  if (shouldIncludeFaqTool(state)) {
    tools.push(adsFaqTool);
  }
  return tools;
};

const shouldIncludeFaqTool = (state: AdsGraphState): boolean => {
  const lastMessage = state.messages?.at(-1);
  const isRealHumanMessage =
    lastMessage && HumanMessage.isInstance(lastMessage) && !isContextMessage(lastMessage);
  return Boolean(isRealHumanMessage);
};
