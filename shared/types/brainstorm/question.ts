import z from "zod";

/**
 * Brainstorm.TopicTypes
 */
export const BrainstormTopics = [
  "idea",
  "audience",
  "solution",
  "socialProof",
  "lookAndFeel"
] as const;
export type TopicType = typeof BrainstormTopics[number];
export type MemoriesType = Partial<Record<TopicType, string | null>>;

export const TopicKinds = ["conversational", "ui"];
export type TopicKind = typeof TopicKinds[number];

export const TopicKindMap: Record<TopicType, TopicKind> = {
  idea: "conversational",
  audience: "conversational",
  solution: "conversational",
  socialProof: "conversational",
  lookAndFeel: "ui",
}

export const qaSchema = z.object({
  success: z.boolean().describe("Was the question answered successfully? Does it include enough context to write great marketing copy for the business?"),
  reasoning: z.string().describe("Explain using the criteria why the question was or was not answered successfully."),
})

export type QAResultType = z.infer<typeof qaSchema>;

/**
 * Schema for structured questions with intro, examples, and conclusion
 */
export const questionSchema = z.object({
  text: z.string().describe('A simple message or question'),
  examples: z.array(z.string()).optional().describe(`OPTIONAL: List of examples to help the user understand`),
  conclusion: z.string().optional().describe(`OPTIONAL: Conclusion text to include after examples`),
});

export type QuestionType = z.infer<typeof questionSchema>;

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

export const Actions = ["helpMe", "skip", "doTheRest", "finished"] as const;
export type ActionType = typeof Actions[number];

export const isBrainstormAction = (action: unknown): action is ActionType => {
    return (typeof action === 'string' && action in Actions);
}

export const AvailableActions: Record<TopicType, ActionType[]> = {
    idea: ["helpMe"],
    audience: ["helpMe", "skip", "doTheRest"],
    solution: ["helpMe", "skip", "doTheRest"],
    socialProof: ["helpMe", "skip", "doTheRest"],
    lookAndFeel: ["finished"],
}

export const SkippableTopics: TopicType[] = Object.entries(AvailableActions).filter(([_, actions]) => actions.includes("skip")).map(([topic]) => topic as TopicType);
export const topicIsSkippable = (topic: TopicType) => SkippableTopics.includes(topic);

export const Redirects = ["website_builder"] as const;
export type RedirectType = typeof Redirects[number];