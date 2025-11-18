import { beforeHook } from "./main/beforeHook";
import { type BrainstormGraphState } from "@state";
import { type LangGraphRunnableConfig, Brainstorm } from "@types";
import { defaultPrompt } from "./main/defaultPrompt";
import { helpMePrompt } from "./main/helpMePrompt";
import { uiGuidancePrompt } from "./main/uiGuidancePrompt";
import { finishForMePrompt } from "./main/finishForMePrompt";

export const chooseAgentPrompt = async(inputState: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const state = await beforeHook(inputState);
    const currentTopicName = state.currentTopic;
    const topic = Brainstorm.getTopic(currentTopicName);

    if (topic.kind === "conversational") {
        return await conversationalPrompt(state, config);
    }
    if (state.skippedTopics?.length > 0) {
        return await finishForMePrompt(state, config);
    }

    return await uiGuidancePrompt(state, config);
}

const conversationalPrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const behavior: Brainstorm.AgentBehaviorType = state.command || "default";
    
    switch (behavior) {
        case "default":
            return await defaultPrompt(state, config);
        case "helpMe":
            return await helpMePrompt(state, config);
        case "doTheRest":
            return await finishForMePrompt(state, config);
        default:
            return await defaultPrompt(state, config);
    }
}
