import { type BrainstormGraphState } from "@state";
import { Brainstorm } from "@types";
import { db, eq, asc, brainstorms as brainstormsTable } from "@db";
import { pick } from "@utils";

export class BrainstormNextStepsService {
    state: BrainstormGraphState;
    memories: Brainstorm.MemoriesType | undefined;
    currentTopic: Brainstorm.TopicType | undefined;
    placeholderText: string | undefined;
    remainingTopics: Brainstorm.TopicType[] | undefined;
    availableActions: Brainstorm.ActionType[] | undefined;

    constructor(state: BrainstormGraphState) {
        this.state = state;
    }

    async nextSteps() {
        const memories = await this.getMemories();
        const placeholderText = await this.getPlaceholderText();
        const currentTopic = await this.getCurrentTopic();
        const remainingTopics = await this.getRemainingTopics();
        const availableActions = await this.getAvailableActions();

        return {
            memories: memories as Brainstorm.MemoriesType,
            placeholderText: placeholderText as string,
            currentTopic: currentTopic as Brainstorm.TopicType,
            remainingTopics: remainingTopics as Brainstorm.TopicType[],
            availableActions: availableActions as Brainstorm.ActionType[],
        }
    }

    async getMemories(): Promise<Brainstorm.MemoriesType> {
        if (this.memories) {
            return this.memories;
        }

        if (!this.state.websiteId) {
            throw new Error("websiteId is required");
        }
        const brainstorms = (await db.select().from(brainstormsTable).where(
                eq(brainstormsTable.websiteId, this.state.websiteId)
        ).orderBy(asc(brainstormsTable.id)))[0];
        let memories: Brainstorm.MemoriesType = {}
        if (brainstorms) {
            memories = pick(brainstorms, [...Brainstorm.BrainstormTopics]);
        }
        this.memories = memories;
        return memories;
    }


    private async getRemainingTopics() {
        if (this.remainingTopics) {
            return this.remainingTopics;
        }
        const answers = await this.getMemories();
        const questionsAnswered = Object.keys(answers).filter(key => answers[key as Brainstorm.TopicType] !== null && answers[key as Brainstorm.TopicType] !== "") as Brainstorm.TopicType[];
        const topics = Brainstorm.BrainstormTopics;
        const remainingTopics = topics.filter(topic => !questionsAnswered.includes(topic));
        this.remainingTopics = remainingTopics;
        return remainingTopics;
    }

    private async getCurrentTopic() {
        if (this.currentTopic) {
            return this.currentTopic;
        }
        this.currentTopic = (await this.getRemainingTopics()).at(0);
        return this.currentTopic;
    }

    private async getPlaceholderText() {
        if (this.placeholderText) {
            return this.placeholderText;
        }
        const currentTopic = await this.getCurrentTopic();
        this.placeholderText = currentTopic ? Brainstorm.PlaceholderText[currentTopic] : "";
        return this.placeholderText;
    }

    private async getAvailableActions(): Promise<Brainstorm.ActionType[]> {
        if (this.availableActions) {
            return this.availableActions;
        }
        const currentTopic = await this.getCurrentTopic();
        if (!currentTopic) {
            return ["finished"];
        }
        this.availableActions = Brainstorm.AvailableActions[currentTopic];
        return this.availableActions;
    }
}