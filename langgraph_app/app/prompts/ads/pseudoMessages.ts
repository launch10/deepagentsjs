import { HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { type AdsGraphState } from "@state";

const PSEUDO_MESSAGE_PREFIX = "__SYSTEM__";

export const PseudoMessages = {
    BEGIN: `${PSEUDO_MESSAGE_PREFIX} Generate the assets now.`,
    REFRESH: (asset: string) => `${PSEUDO_MESSAGE_PREFIX} Generate new ${asset} now.`,
} as const;

export const isPseudoMessage = (msg: BaseMessage): boolean => {
    const content = typeof msg.content === 'string' ? msg.content : '';
    return content.startsWith(PSEUDO_MESSAGE_PREFIX);
};

export const needsPseudoMessage = (state: AdsGraphState): boolean => {
    const hasMessages = (state.messages?.length ?? 0) > 0;
    const isRefresh = state.refresh !== undefined;
    return !hasMessages || isRefresh;
};

export const getPseudoMessage = (state: AdsGraphState): HumanMessage | null => {
    if (state.refresh) {
        return new HumanMessage(PseudoMessages.REFRESH(state.refresh.asset));
    }
    if (!state.messages?.length) {
        return new HumanMessage(PseudoMessages.BEGIN);
    }
    return null;
};

export const injectPseudoMessage = (state: AdsGraphState): BaseMessage[] => {
    const messages = state.messages ?? [];
    const pseudo = getPseudoMessage(state);
    return pseudo ? [...messages, pseudo] : messages;
};

export const filterPseudoMessages = (messages: BaseMessage[]): BaseMessage[] => {
    return messages.filter(msg => !isPseudoMessage(msg));
};
