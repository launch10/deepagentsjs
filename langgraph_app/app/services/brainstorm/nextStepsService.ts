import { type BrainstormGraphState } from "@state";
import { Brainstorm } from "@types";
import { db, eq, asc, brainstorms as brainstormsTable } from "@db";
import { pick } from "@utils";

export class BrainstormNextStepsService {
    websiteId: number | undefined;
    memories: Brainstorm.MemoriesType | undefined;
    currentTopic: Brainstorm.TopicType | undefined;
    placeholderText: string | undefined;
    remainingTopics: Brainstorm.TopicType[] | undefined;
    availableCommands: Brainstorm.CommandType[] | undefined;
    skippedTopics: Brainstorm.TopicType[];

    constructor(state: BrainstormGraphState) {
        this.websiteId = state.websiteId;
        this.skippedTopics = state.skippedTopics || [];
    }

    async nextSteps(includeSkipped: boolean = false) {
        const memories = await this.getMemories();
        const placeholderText = await this.getPlaceholderText(includeSkipped);
        const currentTopic = await this.getCurrentTopic(includeSkipped);
        const remainingTopics = await this.getRemainingTopics(includeSkipped);
        const availableCommands = await this.getAvailableCommands(includeSkipped);

        return {
            memories: memories as Brainstorm.MemoriesType,
            placeholderText: placeholderText as string,
            currentTopic: currentTopic as Brainstorm.TopicType,
            remainingTopics: remainingTopics as Brainstorm.TopicType[],
            availableCommands: availableCommands as Brainstorm.CommandType[],
        }
    }

    async getMemories(): Promise<Brainstorm.MemoriesType> {
        if (this.memories) {
            return this.memories;
        }

        if (!this.websiteId) {
            throw new Error("websiteId is required");
        }
        const brainstorms = (await db.select().from(brainstormsTable).where(
                eq(brainstormsTable.websiteId, this.websiteId)
        ).orderBy(asc(brainstormsTable.id)))[0];
        let memories: Brainstorm.MemoriesType = {}
        if (brainstorms) {
            memories = pick(brainstorms, [...Brainstorm.BrainstormTopics]);
        }
        this.memories = memories;
        return memories;
    }


    private async getRemainingTopics(includeSkipped: boolean = false) {
        if (this.remainingTopics) {
            return this.remainingTopics;
        }
        const answers = await this.getMemories();
        const questionsAnswered = Object.keys(answers).filter(key => answers[key as Brainstorm.TopicType] !== null && answers[key as Brainstorm.TopicType] !== "") as Brainstorm.TopicType[];
        const topics = Brainstorm.BrainstormTopics;
        // Filter out answered topics, and also skipped topics (unless includeSkipped is true)
        const remainingTopics = topics.filter(topic =>
            !questionsAnswered.includes(topic) &&
            (includeSkipped || !this.skippedTopics.includes(topic))
        );
        this.remainingTopics = remainingTopics;
        return remainingTopics;
    }

    private async getCurrentTopic(includeSkipped: boolean = false) {
        if (this.currentTopic) {
            return this.currentTopic;
        }
        this.currentTopic = (await this.getRemainingTopics(includeSkipped)).at(0);
        return this.currentTopic;
    }

    private async getPlaceholderText(includeSkipped: boolean = false) {
        if (this.placeholderText) {
            return this.placeholderText;
        }
        const currentTopic = await this.getCurrentTopic(includeSkipped);
        this.placeholderText = currentTopic ? Brainstorm.PlaceholderText[currentTopic] : "";
        return this.placeholderText;
    }

    private async getAvailableCommands(includeSkipped: boolean = false): Promise<Brainstorm.CommandType[]> {
        if (this.availableCommands) {
            return this.availableCommands;
        }
        const currentTopic = await this.getCurrentTopic(includeSkipped);
        if (!currentTopic) {
            return ["finished"];
        }
        this.availableCommands = Brainstorm.AvailableCommands[currentTopic];
        return this.availableCommands;
    }
}