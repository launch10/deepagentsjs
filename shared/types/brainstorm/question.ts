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

/**
 * Schema for structured questions with intro, examples, and conclusion
 */
export const questionSchema = z.object({
  text: z.string().describe('A simple intro to the question'),
  examples: z.array(z.string()).optional().describe(`OPTIONAL: List of examples to help the user understand what we're asking.`),
  conclusion: z.string().optional().describe(`OPTIONAL: Conclusion text to include after examples`),
});

export type QuestionType = z.infer<typeof questionSchema>;

export const PlaceholderText: Record<TopicType, string> = {
  idea: "I want to acquire leads, sell my product...",
  audience: "Who is the target audience? What are their pain points? What are their goals?",
  solution: "How does the user's business solve the audience's pain points, or help them reach their goals?",
  socialProof: "Social proof or testimonials to include on the landing page. Remember, anything can be social proof: the user's background, experience, beliefs, founder story, etc.",
  lookAndFeel: "The look and feel of the landing page.",
}

export const Actions = ["helpMeAnswer", "skip", "doTheRest", "finished"] as const;
export type ActionType = typeof Actions[number];

export const isBrainstormAction = (action: unknown): action is ActionType => {
    return (typeof action === 'string' && action in Actions);
}

export const availableActions: Record<TopicType, ActionType[]> = {
    idea: ["helpMeAnswer"],
    audience: ["helpMeAnswer", "skip", "doTheRest", "finished"],
    solution: ["helpMeAnswer", "skip", "doTheRest", "finished"],
    socialProof: ["helpMeAnswer", "skip", "doTheRest", "finished"],
    lookAndFeel: ["finished"],
}