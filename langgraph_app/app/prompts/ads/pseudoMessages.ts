import { type BaseMessage, AIMessage } from "@langchain/core/messages";
import { type AdsGraphState } from "@state";
import { Ads } from "@types";
import {
  isContextMessage,
  createContextMessage,
  filterContextMessages,
  injectContextMessage,
  type ContextMessage,
} from "langgraph-ai-sdk";

const PAGE_NAMES: Record<Ads.StageName, string> = {
  content: "the headlines and descriptions page",
  highlights: "the callouts and structured snippets page",
  keywords: "the keywords page",
  settings: "the campaign settings page",
  launch: "the review page",
  review: "the review page",
};

export const ContextMessages = {
  BEGIN: "Generate the assets now.",
  REFRESH: (asset: string) => `Generate new ${asset} now.`,
  PAGE_SWITCH: (stage: Ads.StageName) =>
    `User switched to ${PAGE_NAMES[stage]}. Focus on these assets now.`,
} as const;

/** @deprecated Use ContextMessages instead */
export const PseudoMessages = ContextMessages;

// Re-export the shared utilities
export { isContextMessage, filterContextMessages };

/** @deprecated Use isContextMessage instead */
export const isPseudoMessage = isContextMessage;

/** @deprecated Use filterContextMessages instead */
export const filterPseudoMessages = filterContextMessages;

export const lastMessageIsAIMessage = (state: AdsGraphState): boolean => {
  const lastMessage = state.messages?.at(-1);
  return !!lastMessage && AIMessage.isInstance(lastMessage);
};

export const didSwitchPage = (state: AdsGraphState): boolean => {
  return !!state.previousStage && !!state.stage && state.previousStage !== state.stage;
};

export const needsContextMessage = (state: AdsGraphState): boolean => {
  const hasMessages = (state.messages?.length ?? 0) > 0;
  const isRefresh = !!state.refresh?.length;
  const switchedPage = didSwitchPage(state);
  return !hasMessages || isRefresh || switchedPage;
};

/** @deprecated Use needsContextMessage instead */
export const needsPseudoMessage = needsContextMessage;

export const getContextMessage = (state: AdsGraphState): ContextMessage | null => {
  if (state.refresh?.length) {
    const assetNames = state.refresh.map((r) => r.asset).join(" and ");
    return createContextMessage(ContextMessages.REFRESH(assetNames));
  }
  if (didSwitchPage(state) && state.stage) {
    return createContextMessage(ContextMessages.PAGE_SWITCH(state.stage));
  }
  if (state.messages?.length === 0 || lastMessageIsAIMessage(state)) {
    return createContextMessage(ContextMessages.BEGIN);
  }
  // This should only fall through in the case where the user sent THEIR OWN message
  return null;
};

/** @deprecated Use getContextMessage instead */
export const getPseudoMessage = getContextMessage;

/**
 * Ads-specific helper that gets the appropriate context message for the current state
 * and injects it into the messages array.
 */
export const injectAdsContextMessage = (state: AdsGraphState): BaseMessage[] => {
  const messages = state.messages ?? [];
  const contextMsg = getContextMessage(state);
  return injectContextMessage(messages, contextMsg);
};

/** @deprecated Use injectAdsContextMessage instead */
export const injectAdsPseudoMessage = injectAdsContextMessage;

/** @deprecated Use injectAdsContextMessage instead */
export { injectAdsContextMessage as injectPseudoMessage };
