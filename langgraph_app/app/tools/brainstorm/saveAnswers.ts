import { z } from "zod";
import { type BrainstormGraphState } from "@state";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { tool, DynamicStructuredTool } from "@langchain/core/tools";
import { Brainstorm } from "@types";

export const SaveAnswersTool = (state: BrainstormGraphState, config?: LangGraphRunnableConfig): DynamicStructuredTool => {
    const saveAnswersInputSchema = z.object({
        answers: z.array(z.object({
            topic: z.enum(Brainstorm.BrainstormTopics),
            answer: z.string()
        }))
    });

    type SaveAnswersInput = z.infer<typeof saveAnswersInputSchema>;

    async function saveAnswers(args?: SaveAnswersInput): Promise<{ success: boolean }> {
        const updates: Partial<Brainstorm.Memories> = args?.answers?.reduce((acc, { topic, answer }) => {
            if (!topic || !answer) {
                return acc;
            }
            acc[topic] = answer;
            return acc;
        }, {} as Record<Brainstorm.Topic, string>) || {}

        // TODO: Save to DB
        // await writeAnswersToJSON(updates);

        return { success: true };
    }

    return tool(saveAnswers, {
        name: "save_answers",
        description: `
            Save answers to the brainstorming session. 
            Call this when the user has answered one or more of the remaining topics.
            IMPORTANT: When saving answers, save AS MUCH context as possible. We need a LOT of high quality content IN THE USER'S OWN WORDS to generate effective marketing copy.
        `,
        schema: saveAnswersInputSchema,
    });
}
