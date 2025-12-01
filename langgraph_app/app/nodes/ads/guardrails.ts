import type { AdsGraphState } from "@state";
import { HumanMessage } from "@langchain/core/messages";
import { Ads } from "@types";

export const guardrailsNode = (state: AdsGraphState): "getBusinessContext" | "__end__" => {
    if (!state.stage) {
        throw new Error("Stage is required");
    }
    if (Ads.isContentStage(state.stage)) {
        return "getBusinessContext";
    }

    const lastMessage = state.messages?.at(-1);
    if (lastMessage && HumanMessage.isInstance(lastMessage)) {
        return "getBusinessContext";
    }

    return "__end__";
};