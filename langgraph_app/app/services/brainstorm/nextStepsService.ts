import { type BrainstormGraphState } from "@state";
import { Brainstorm } from "@types";
import { db, eq, asc, brainstorms as brainstormsTable } from "@db";
import { pick } from "@utils";

export class BrainstormNextStepsService {
  websiteId: number | undefined;
  memories: Brainstorm.MemoriesType | undefined;
  currentTopic: Brainstorm.TopicName | undefined;
  remainingTopics: Brainstorm.TopicName[] | undefined;
  skippedTopics: Brainstorm.TopicName[];

  constructor({
    websiteId,
    skippedTopics,
  }: Pick<BrainstormGraphState, "websiteId" | "skippedTopics">) {
    this.websiteId = websiteId;
    this.skippedTopics = skippedTopics || [];
  }

  async nextSteps(includeSkipped: boolean = false) {
    const memories = await this.getMemories();
    const currentTopic = await this.getCurrentTopic(includeSkipped);
    const remainingTopics = await this.getRemainingTopics(includeSkipped);
    const topic = Brainstorm.getTopic(currentTopic);

    return {
      memories: memories as Brainstorm.MemoriesType,
      currentTopic: currentTopic as Brainstorm.TopicName,
      remainingTopics: remainingTopics as Brainstorm.TopicName[],
      availableIntents: topic?.availableIntents || [],
      placeholderText: topic?.placeholderText,
    };
  }

  async getMemories(): Promise<Brainstorm.MemoriesType> {
    if (this.memories) {
      return this.memories;
    }

    if (!this.websiteId) {
      throw new Error("websiteId is required");
    }
    const brainstorms = (
      await db
        .select()
        .from(brainstormsTable)
        .where(eq(brainstormsTable.websiteId, this.websiteId))
        .orderBy(asc(brainstormsTable.id))
    )[0];
    let memories: Partial<Brainstorm.MemoriesType> = {};
    if (brainstorms) {
      memories = pick(brainstorms, [...Brainstorm.ConversationalTopics]); // Never show memories of UI topics so we'll always have at least 1 topic remaining...
    }
    this.memories = memories as Brainstorm.MemoriesType;
    return this.memories;
  }

  private async getRemainingTopics(includeSkipped: boolean = false) {
    if (this.remainingTopics) {
      return this.remainingTopics;
    }
    const answers = await this.getMemories();
    const questionsAnswered = Object.keys(answers).filter(
      (key) =>
        answers[key as Brainstorm.ConversationalTopicName] !== null &&
        answers[key as Brainstorm.ConversationalTopicName] !== ""
    ) as Brainstorm.ConversationalTopicName[];
    const topics = Brainstorm.BrainstormTopics;
    // Filter out answered topics, and also skipped topics (unless includeSkipped is true)
    const remainingTopics = topics.filter(
      (topic) =>
        !questionsAnswered.includes(topic as any) &&
        (includeSkipped || !this.skippedTopics.includes(topic))
    );
    this.remainingTopics = remainingTopics;
    return remainingTopics;
  }

  private async getCurrentTopic(includeSkipped: boolean = false) {
    if (this.currentTopic) {
      return this.currentTopic;
    }
    let currentTopicName = (await this.getRemainingTopics(includeSkipped)).at(0);
    if (!currentTopicName) {
      throw new Error("No remaining topics found");
    }
    this.currentTopic = currentTopicName;
    return this.currentTopic;
  }
}
