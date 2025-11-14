import { beforeHook } from "./behaviors/beforeHook";
import { type BrainstormGraphState } from "@state";
import { type LangGraphRunnableConfig, Brainstorm } from "@types";
import { defaultPrompt } from "./behaviors/defaultPrompt";
import { helpMePrompt } from "./behaviors/helpMePrompt";
import { uiGuidancePrompt } from "./behaviors/uiGuidancePrompt";
import { finishForMePrompt } from "./behaviors/finishForMePrompt";

export const agentPrompt = async(inputState: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const state = await beforeHook(inputState);
    const currentTopic = state.currentTopic;

    if (Brainstorm.TopicKindMap[currentTopic] === "conversational") {
        return await conversationalPrompt(state, config);
    }
    if (state.skippedTopics?.length > 0) {
        return await finishForMePrompt(state, config);
    }
    debugger;

    return await uiGuidancePrompt(state, config);
}

const conversationalPrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const behavior: Brainstorm.AgentBehaviorType = state.command || "default";
    
    switch (behavior) {
        case "default":
            return await defaultPrompt(state, config);
        case "helpMe":
            return await helpMePrompt(state, config);
        default:
            return await defaultPrompt(state, config);
    }
}
