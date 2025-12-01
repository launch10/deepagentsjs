import type { AdsGraphState } from "@state";
import { HumanMessage } from "@langchain/core/messages";
import { Ads } from "@types";

// The point of the guardrails node is to ensure 
// we don't route to the agent when the request is invalid
//
// The expected request types are:
// 1) A content stage (content, highlights, keywords), with a request to generate content
// 2) A human message with a question (at any stage)
//
// If either of those is NOT met, we should end the conversation
//
export const guardrailsNode = (state: AdsGraphState): "getBusinessContext" | "__end__" => {
    if (!state.stage) {
        throw new Error("Stage is required");
    }

    const lastMessage = state.messages?.at(-1);
    const lastMessageIsHumanQuestion = lastMessage && HumanMessage.isInstance(lastMessage);

    if (Ads.isContentStage(state.stage) || lastMessageIsHumanQuestion) {
        return "getBusinessContext"; // route to the agent
    }

    return "__end__"; // end the conversation
};