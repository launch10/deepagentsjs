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
export const guardrailsNode = (state: AdsGraphState): "beforeGenerate" | "end" => {
  if (!state.stage) {
    throw new Error("Stage is required");
  }

  const lastMessage = state.messages?.at(-1);
  const lastMessageIsHumanQuestion = lastMessage && HumanMessage.isInstance(lastMessage);

  if (lastMessageIsHumanQuestion) {
    return "beforeGenerate";
  }

  if (Ads.isContentStage(state.stage) && validRequest(state)) {
    return "beforeGenerate"; // route to the agent
  }

  return "end"; // exit (credit exhaustion handled by wrapper)
};

const validRequest = (state: AdsGraphState): boolean => {
  if (!state.stage) {
    return false;
  }
  if (!state.hasStartedStep) {
    return true;
  }
  if (validRefresh(state)) {
    return true;
  }
  return state.hasStartedStep[state.stage] !== true || !Ads.stageLoadedSuccessfully(state, state.stage);
};

const validRefresh = (state: AdsGraphState): boolean => {
  return !!state.refresh;
};
