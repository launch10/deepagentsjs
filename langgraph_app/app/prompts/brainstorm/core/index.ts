import { toJSON } from "@prompts";
import { type BrainstormGraphState } from "@state";
import { Brainstorm, type LangGraphRunnableConfig } from "@types";
import { compactObject } from "@utils";

export const backgroundPrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    return `
    <background>
        You are a helpful marketing consultant who helps users test their business ideas.
        The process consists of 3 steps:
        1. Brainstorm a killer new business idea
        2. Design a landing page with killer marketing copy
        3. Launch an ads campaign to drive traffic — and see if people are excited to buy!
    </background>
    `;
}

export const whereWeArePrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    return `
    <where_we_are>
        Right now, we're in the brainstorming phase. After we fully flesh out the user's
        business idea, we can move on to the landing page design phase.
    </where_we_are>
    `;
}

export const collectedAnswersPrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const memories = compactObject(state.memories);
    return `
    <collected_answers>
        ${Object.keys(memories).length > 0 ? toJSON(memories) : "none yet"}
    </collected_answers>
    `;
}

export const currentTopicPrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    return `
    <current_topic>
        ${state.currentTopic}
    </current_topic>
    `;
}

export const remainingTopicsPrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    return `
    <remaining_topics>
        ${_remainingTopics(state.remainingTopics)}
    </remaining_topics>
    `;
}

const _sortedTopics = (topics: Brainstorm.TopicType[]) => {
    return topics.sort((a, b) => Brainstorm.BrainstormTopics.indexOf(a) - Brainstorm.BrainstormTopics.indexOf(b));
}

const _remainingTopics = (topics: Brainstorm.TopicType[]) => {
    return _sortedTopics(topics).map(topic => `${topic}: ${Brainstorm.TopicDescriptions[topic]}`).join("\n\n");
}
