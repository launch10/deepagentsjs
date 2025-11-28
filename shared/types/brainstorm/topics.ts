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