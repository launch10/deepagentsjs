import { type AdsGraphState } from "@state";
import { isContextMessage } from "langgraph-ai-sdk";
import { HumanMessage } from "@langchain/core/messages";
import { Ads } from "@types";

export const needsIntentClassification = (state: AdsGraphState): boolean => {
  const lastMessage = state.messages?.at(-1);
  const isRealHumanMessage =
    lastMessage && HumanMessage.isInstance(lastMessage) && !isContextMessage(lastMessage);
  return !!isRealHumanMessage && !!state.stage && Ads.isContentStage(state.stage);
};
