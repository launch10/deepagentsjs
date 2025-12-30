import z from "zod";
import { CommandNames } from "./commands";

export const TopicKinds = ["conversational", "ui"] as const;
export type TopicKind = typeof TopicKinds[number];

export const TopicNames = ["idea", "audience", "solution", "socialProof", "lookAndFeel"] as const;
export type TopicName = typeof TopicNames[number];

export const BrainstormTopics = ["idea", "audience", "solution", "socialProof", "lookAndFeel"] as const;
export const ConversationalTopics = ["idea", "audience", "solution", "socialProof"] as const;
export type ConversationalTopicName = typeof ConversationalTopics[number];
export const UITopics = ["lookAndFeel"] as const;

export const topicSchema = z.object({
    name: z.enum(TopicNames),
    kind: z.enum(TopicKinds),
    description: z.string(),
    placeholderText: z.string(),
    availableCommands: z.array(z.enum(CommandNames)),
    skippable: z.boolean(),
    hardcodedQuestion: z.string().optional(),
})

export type Topic = z.infer<typeof topicSchema>;

export const Topics: Record<TopicName, Topic> = {
    idea: {
        name: "idea",
        kind: "conversational",
        description: "The core business idea. What does the business do? What makes them different?",
        placeholderText: "I want to acquire leads, sell my product...",
        availableCommands: ["helpMe"],
        skippable: false,
        hardcodedQuestion: "Tell us about your business. More info → better outcomes.",
    },
    audience: {
        name: "audience",
        kind: "conversational",
        description: "The target audience. What are their pain points? What are their goals?",
        placeholderText: "My target audience is...",
        availableCommands: ["helpMe", "skip", "doTheRest"],
        skippable: true,
    },
    solution: {
        name: "solution",
        kind: "conversational",
        description: "How does the user's business solve the audience's pain points, or help them reach their goals?",
        placeholderText: "My solution is...",
        availableCommands: ["helpMe", "skip", "doTheRest"],
        skippable: true,
    },
    socialProof: {
        name: "socialProof",
        kind: "conversational",
        description: "Social proof or testimonials to include on the landing page. Remember, anything can be social proof: the user's background, experience, beliefs, founder story, etc.",
        placeholderText: "My social proof is...",
        availableCommands: ["helpMe", "skip", "doTheRest"],
        skippable: true,
    },
    lookAndFeel: {
        name: "lookAndFeel",
        kind: "ui",
        description: "The look and feel of the landing page.",
        placeholderText: "Use the Advanced sidebar or click \"Build My Site\"...",
        availableCommands: ["finished"],
        skippable: false,
    },
}

export const getTopic = (topicName: TopicName): Topic => {
    return Topics[topicName];
}

export const getAllTopics = (): Topic[] => {
    return Object.values(Topics);
}

export const topicsAndDescriptions = (topics: TopicName[]): string => {
    return topics.map((topic) => Topics[topic].description).join("\n\n");
}

export const MemoriesSchema = z.object({
    idea: z.string().optional().nullable(),
    audience: z.string().optional().nullable(),
    solution: z.string().optional().nullable(),
    socialProof: z.string().optional().nullable(),
})

export type MemoriesType = z.infer<typeof MemoriesSchema>;

/**
 * Memory fields in order, corresponding to conversational topics.
 * Used to calculate current question number.
 */
const MemoryFields: (keyof MemoriesType)[] = ["idea", "audience", "solution", "socialProof"];

/**
 * Get the current question number based on completed memories.
 * - Question 1: idea is undefined
 * - Question 2: audience is undefined
 * - Question 3: solution is undefined
 * - Question 4: socialProof is undefined
 * - Question 5: all memories complete (lookAndFeel topic)
 */
export function getCurrentQuestionNumber(memories: MemoriesType | undefined | null): number {
    if (!memories) return 1;

    for (let i = 0; i < MemoryFields.length; i++) {
        const field = MemoryFields[i];
        const value = memories[field];
        if (value === undefined || value === null) {
            return i + 1;
        }
    }

    // All memories complete - we're on the 5th question (lookAndFeel)
    return BrainstormTopics.length;
}

/**
 * Get the question number for a specific topic.
 * Maps topic names to their corresponding question numbers (1-indexed).
 */
export function getQuestionNumberForTopic(topic: TopicName | undefined | null): number {
    if (!topic) return 1;
    const index = BrainstormTopics.indexOf(topic);
    return index === -1 ? 1 : index + 1;
}

/**
 * Total number of brainstorm questions.
 */
export const TotalQuestions = BrainstormTopics.length;