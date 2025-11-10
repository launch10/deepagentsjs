import z from "zod";
import { AIMessage } from "@langchain/core/messages";

/**
 * Brainstorm topics
 */
export const brainstormTopics = [
  "idea",
  "audience",
  "solution",
  "socialProof",
  "lookAndFeel"
] as const;
export type BrainstormTopic = typeof brainstormTopics[number];
export type Brainstorm = Partial<Record<BrainstormTopic, string>>;

/**
 * Schema for structured questions with intro, examples, and conclusion
 */
export const questionSchema = z.object({
  text: z.string().describe('A simple intro to the question'),
  examples: z.array(z.string()).optional().describe(`OPTIONAL: List of examples to help the user understand what we're asking.`),
  conclusion: z.string().optional().describe(`OPTIONAL: Conclusion text to include after examples`),
});

export type QuestionType = z.infer<typeof questionSchema>;

export const ActionTypes = ["helpMeAnswer", "skip", "doTheRest", "finished"] as const;
export type ActionType = typeof ActionTypes[number];

export const isBrainstormAction = (action: unknown): action is ActionType => {
    return (typeof action === 'string' && action in ActionTypes);
}

export const availableActions: Record<BrainstormTopic, ActionType[]> = {
    idea: ["helpMeAnswer"],
    audience: ["helpMeAnswer", "skip", "doTheRest", "finished"],
    solution: ["helpMeAnswer", "skip", "doTheRest", "finished"],
    socialProof: ["helpMeAnswer", "skip", "doTheRest", "finished"],
    lookAndFeel: ["finished"],
}