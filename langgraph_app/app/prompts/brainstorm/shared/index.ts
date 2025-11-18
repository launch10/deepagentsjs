import { toJSON } from "@prompts";
import { type BrainstormGraphState } from "@state";
import { Brainstorm, type LangGraphRunnableConfig } from "@types";
import { compactObject } from "@utils";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { readdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export const getTopicDescriptions = async(topics: Brainstorm.TopicName[]): Promise<string> => {
    return await Promise.all(
        topics.map(topic => fs.promises.readFile(path.join(__dirname, `../topics/${topic}.md`), 'utf-8'))
    ).then((topicText) => topicText.join("\n\n"))
}

export const getHelpTemplates = async(topics: Brainstorm.TopicName[]): Promise<string> => {
    return await Promise.all(
        topics.map(topic => fs.promises.readFile(path.join(__dirname, `../help/${topic}.md`), 'utf-8'))
    ).then((helpText) => helpText.join("\n\n"))
}

export const getMarketingReferences = async (): Promise<string> => {
    const referencesDir = path.join(__dirname, '../references');
    const files = readdirSync(referencesDir)
        .filter(file => file.endsWith('.md'))
          .map(file => path.join(referencesDir, file));

    return await Promise.all(
        files.map(file => fs.promises.readFile(file, 'utf-8'))
    ).then((helpText) => helpText.join("\n\n"))
}

const _sortedTopics = (topics: Brainstorm.Topic[]) => {
    return topics.sort((a, b) => Brainstorm.BrainstormTopics.indexOf(a.name) - Brainstorm.BrainstormTopics.indexOf(b.name));
}

const _remainingTopics = (topics: Brainstorm.TopicName[]) => {
    const allTopics = Brainstorm.getAllTopics()
    const selectedTopics = allTopics.filter(topic => topics.includes(topic.name))
    return _sortedTopics(selectedTopics).map(topic => `${topic.name}: ${topic.description}`).join("\n\n");
}
