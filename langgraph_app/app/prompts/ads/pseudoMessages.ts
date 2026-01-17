import { HumanMessage, type BaseMessage, AIMessage } from "@langchain/core/messages";
import { type AdsGraphState } from "@state";
import { Ads } from "@types";
import {
  isPseudoMessage,
  createPseudoMessage,
  filterPseudoMessages,
  injectPseudoMessage,
} from "@utils";

const PAGE_NAMES: Record<Ads.StageName, string> = {
  content: "the headlines and descriptions page",
  highlights: "the callouts and structured snippets page",
  keywords: "the keywords page",
  settings: "the campaign settings page",
  launch: "the review page",
  review: "the review page",
};

export const PseudoMessages = {
  BEGIN: "Generate the assets now.",
  REFRESH: (asset: string) => `Generate new ${asset} now.`,
  PAGE_SWITCH: (stage: Ads.StageName) =>
    `User switched to ${PAGE_NAMES[stage]}. Focus on these assets now.`,
} as const;

// Re-export the shared utility for backwards compatibility
export { isPseudoMessage, filterPseudoMessages };

export const lastMessageIsAIMessage = (state: AdsGraphState): boolean => {
  const lastMessage = state.messages?.at(-1);
  return !!lastMessage && AIMessage.isInstance(lastMessage);
};

export const didSwitchPage = (state: AdsGraphState): boolean => {
  return !!state.previousStage && !!state.stage && state.previousStage !== state.stage;
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
    return createPseudoMessage(PseudoMessages.REFRESH(assetNames));
  }
  if (didSwitchPage(state) && state.stage) {
    return createPseudoMessage(PseudoMessages.PAGE_SWITCH(state.stage));
  }
  if (state.messages?.length === 0 || lastMessageIsAIMessage(state)) {
    return createPseudoMessage(PseudoMessages.BEGIN);
  }
  // This should only fall through in the case where the user sent THEIR OWN message
  return null;
};

/**
 * Ads-specific helper that gets the appropriate pseudo message for the current state
 * and injects it into the messages array.
 */
export const injectAdsPseudoMessage = (state: AdsGraphState): BaseMessage[] => {
  const messages = state.messages ?? [];
  const pseudo = getPseudoMessage(state);
  return injectPseudoMessage(messages, pseudo);
};

// Backwards compatibility alias
export { injectAdsPseudoMessage as injectPseudoMessage };
