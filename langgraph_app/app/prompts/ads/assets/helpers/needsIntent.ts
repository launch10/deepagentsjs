import { type AdsGraphState } from "@state";
import { isPseudoMessage } from "../../pseudoMessages";
import { HumanMessage } from "@langchain/core/messages";

export const needsIntentClassification = (state: AdsGraphState): boolean => {
    const lastMessage = state.messages?.at(-1);
    const isRealHumanMessage = lastMessage && HumanMessage.isInstance(lastMessage) && !isPseudoMessage(lastMessage);
    return !!isRealHumanMessage;
};