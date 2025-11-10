import z from "zod";

/**
 * Brainstorm topics
 */
export const BrainstormTopics = [
  "idea",
  "audience",
  "solution",
  "socialProof",
  "lookAndFeel"
] as const;
export type Topic = typeof BrainstormTopics[number];
export type Memories = Partial<Record<Topic, string>>;

/**
 * Schema for structured questions with intro, examples, and conclusion
 */
export const messageSchema = z.object({
  text: z.string().describe('A simple intro to the question'),
  examples: z.array(z.string()).optional().describe(`OPTIONAL: List of examples to help the user understand what we're asking.`),
  conclusion: z.string().optional().describe(`OPTIONAL: Conclusion text to include after examples`),
});

export type Message = z.infer<typeof messageSchema>;

export const Actions = ["helpMeAnswer", "skip", "doTheRest", "finished"] as const;
export type Action = typeof Actions[number];

export const isBrainstormAction = (action: unknown): action is Action => {
    return (typeof action === 'string' && action in Actions);
}

export const availableActions: Record<Topic, Action[]> = {
    idea: ["helpMeAnswer"],
    audience: ["helpMeAnswer", "skip", "doTheRest", "finished"],
    solution: ["helpMeAnswer", "skip", "doTheRest", "finished"],
    socialProof: ["helpMeAnswer", "skip", "doTheRest", "finished"],
    lookAndFeel: ["finished"],
}