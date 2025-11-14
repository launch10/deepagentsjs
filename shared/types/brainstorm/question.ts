import z from "zod";
import type { ConditionalKeys } from 'type-fest';

/**
 * Brainstorm.TopicTypes
 */
export const TopicKindMap = {
  idea: "conversational",
  audience: "conversational",
  solution: "conversational",
  socialProof: "conversational",
  lookAndFeel: "ui",
} as const;

export const TopicKinds = ["conversational", "ui"] as const;
export type TopicKind = typeof TopicKindMap[keyof typeof TopicKindMap];
export type TopicType = keyof typeof TopicKindMap;

export type ConversationalTopicType = ConditionalKeys<typeof TopicKindMap, "conversational">;
export type UITopicType = ConditionalKeys<typeof TopicKindMap, "ui">;

export const BrainstormTopics = ["idea", "audience", "solution", "socialProof", "lookAndFeel"] as const;
export const ConversationalTopics = ["idea", "audience", "solution", "socialProof"] as const;
export const UITopics = ["lookAndFeel"] as const;

/**
 * Schema for structured questions with intro, examples, and conclusion
 */
export const replySchema = z.object({
  type: z.literal("reply"),
  text: z.string().describe('A simple message or question'),
  examples: z.array(z.string()).optional().describe(`OPTIONAL: List of examples to help the user understand`),
  conclusion: z.string().optional().describe(`OPTIONAL: Conclusion text to include after examples`),
});

export type ReplyType = z.infer<typeof replySchema>;

export const helpMeSchema = z.object({
    type: z.literal("helpMe"),
    text: z.string().describe('Acknowledge the user and explain that you will help them structure their answer'),
    template: z.string().describe(`REQUIRED: A structured template or framework to help the user articulate their answer with specificity and clarity`),
    examples: z.array(z.string()).describe(`OPTIONAL: A concrete, realistic example to help the user understand`)
});

export type HelpMeResponseType = z.infer<typeof helpMeSchema>;

export const responseSchema = z.discriminatedUnion("type", [
    replySchema,
    helpMeSchema,
]);

export type ResponseType = z.infer<typeof responseSchema>;

export const HardCodedQuestions: Partial<Record<TopicType, string>> = {
    idea: "Tell us about your business. More info → better outcomes.",
}

// Topic descriptions for the brainstorm agent
export const TopicDescriptions: Record<TopicType, string> = {
    idea: `The core business idea. What does the business do? What makes them different?`,
    audience: `The target audience. What are their pain points? What are their goals?`,
    solution: `How does the user's business solve the audience's pain points, or help them reach their goals?`,
    socialProof: `Social proof or testimonials to include on the landing page. Remember, anything can be social proof: the user's background, experience, beliefs, founder story, etc.`,
    lookAndFeel: "The look and feel of the landing page.",
}

export const PlaceholderText: Record<TopicType, string> = {
  idea: "I want to acquire leads, sell my product...",
  audience: "My target audience is...",
  solution: "My solution is...",
  socialProof: "My social proof is...",
  lookAndFeel: `Use the Advanced sidebar or click "Build My Site"...`,
}

export const Commands = ["helpMe", "skip", "doTheRest", "finished"] as const;
export type CommandType = typeof Commands[number];

export const AgentBehavior = [...Commands, "default"] as const;
export type AgentBehaviorType = typeof AgentBehavior[number];

export const isBrainstormCommand = (command: unknown): command is CommandType => {
    return (typeof command === 'string' && command in Commands);
}

export const AvailableCommands: Record<TopicType, CommandType[]> = {
    idea: ["helpMe"],
    audience: ["helpMe", "skip", "doTheRest"],
    solution: ["helpMe", "skip", "doTheRest"],
    socialProof: ["helpMe", "skip", "doTheRest"],
    lookAndFeel: ["finished"],
}

export const SkippableTopics: TopicType[] = Object.entries(AvailableCommands).filter(([_, actions]) => actions.includes("skip")).map(([topic]) => topic as TopicType);
export const topicIsSkippable = (topic: TopicType) => SkippableTopics.includes(topic);

export const Redirects = ["website_builder"] as const;
export type RedirectType = typeof Redirects[number];
