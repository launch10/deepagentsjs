import { HumanMessage, type BaseMessage, AIMessage } from "@langchain/core/messages";
import { type AdsGraphState } from "@state";
import { Ads } from "@types";

const PSEUDO_MESSAGE_PREFIX = "__SYSTEM__";

const PAGE_NAMES: Record<Ads.StageName, string> = {
  "content": "the headlines and descriptions page",
  "highlights": "the callouts and structured snippets page",
  "keywords": "the keywords page",
  "settings": "the campaign settings page",
  "launch": "the review page",
  "review": "the review page",
  "deployment": "the deployment page",
};

export const PseudoMessages = {
  BEGIN: `${PSEUDO_MESSAGE_PREFIX} Generate the assets now.`,
  REFRESH: (asset: string) => `${PSEUDO_MESSAGE_PREFIX} Generate new ${asset} now.`,
  PAGE_SWITCH: (stage: Ads.StageName) => `${PSEUDO_MESSAGE_PREFIX} User switched to ${PAGE_NAMES[stage]}. Focus on these assets now.`,
} as const;

export const isPseudoMessage = (msg: BaseMessage): boolean => {
  const content = typeof msg.content === "string" ? msg.content : "";
  return content.startsWith(PSEUDO_MESSAGE_PREFIX);
};

export const lastMessageIsAIMessage = (state: AdsGraphState): boolean => {
  const lastMessage = state.messages?.at(-1);
  return !!lastMessage && AIMessage.isInstance(lastMessage);
};

export const didSwitchPage = (state: AdsGraphState): boolean => {
  return !!state.previousStage && 
         !!state.stage && 
         state.previousStage !== state.stage;
};

export const needsPseudoMessage = (state: AdsGraphState): boolean => {
  const hasMessages = (state.messages?.length ?? 0) > 0;
  const isRefresh = !!state.refresh?.length;
  const switchedPage = didSwitchPage(state);
  return !hasMessages || isRefresh || switchedPage;
};

export const getPseudoMessage = (state: AdsGraphState): HumanMessage | null => {
  if (state.refresh?.length) {
    const assetNames = state.refresh.map((r) => r.asset).join(" and ");
    return new HumanMessage(PseudoMessages.REFRESH(assetNames));
  }
  if (didSwitchPage(state) && state.stage) {
    return new HumanMessage(PseudoMessages.PAGE_SWITCH(state.stage));
  }
  if (state.messages?.length === 0 || lastMessageIsAIMessage(state)) {
    return new HumanMessage(PseudoMessages.BEGIN);
  }
  // This should only fall through in the case where the user sent THEIR OWN message
  return null;
};

export const injectPseudoMessage = (state: AdsGraphState): BaseMessage[] => {
  const messages = state.messages ?? [];
  const pseudo = getPseudoMessage(state);
  return pseudo ? [...messages, pseudo] : messages;
};

export const filterPseudoMessages = (messages: BaseMessage[]): BaseMessage[] => {
  return messages.filter((msg) => !isPseudoMessage(msg));
};
