import { z } from "zod";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLlm, LLMSkill, LLMSpeed } from "@core";
import { renderPrompt, chatHistoryPrompt, structuredOutputPrompt } from "@prompts";
import { isHumanMessage, isAIMessage } from "@types";

export const brainstormGuardrailInputSchema = z.object({
    messages: z.array(z.any()).describe("The conversation messages"),
    questionIndex: z.number().describe("The current question index"),
});

export type BrainstormGuardrailInput = z.infer<typeof brainstormGuardrailInputSchema>;

const brainstormGuardrailPromptOutputSchema = z.object({
    isOnTopic: z.boolean().describe("Whether the user's response adequately answers the previous question"),
    reasoning: z.string().describe("Brief explanation of why the response is on-topic or off-topic")
});

export type BrainstormGuardrailOutput = { 
    userNeedsHelp: boolean; // If not on topic, the user needs help
};

export class BrainstormGuardrailService {
    async execute(input: BrainstormGuardrailInput, config?: LangGraphRunnableConfig): Promise<BrainstormGuardrailOutput> {
        const { messages, questionIndex } = input;
        
        if (!messages || messages.length === 0) {
            return { userNeedsHelp: false };
        }

        const humanMessages = messages.filter(isHumanMessage)
        const lastHumanMessage = humanMessages[humanMessages.length - 1];

        if (!lastHumanMessage) {
            return { userNeedsHelp: false };
        }

        const AIMessages = messages.filter(isAIMessage)
        const lastAIMessage = AIMessages[AIMessages.length - 1];

        if (!lastAIMessage) {
            if (questionIndex !== 0) {
                return { userNeedsHelp: false };
            }
        }

        const [chatHistory, formatInstructions] = await Promise.all([
            chatHistoryPrompt({ messages: messages }),
            structuredOutputPrompt({ schema: brainstormGuardrailPromptOutputSchema })
        ]);

        const promptText = await renderPrompt(`
            <role>
                You are a response validator for a brainstorming conversation about landing pages.
            </role>

            <task>
                Look at the conversation history. The AI asked the user a question, and the user 
                provided a response. Determine if the user's response adequately answers the 
                question that was asked.
                
                A response is OFF-TOPIC **ONLY** if:
                - The user is asking for help or clarification ("what?", "I don't understand", "what do you mean?", "sorry, what's going on?")
                - The user is confused about what to do
                - The user's response is completely unrelated to the question
                - The user provides a clearly confused or non-answer response
                
                A response is ON-TOPIC if:
                - The user attempts to answer the question, even if brief or incomplete
                - The user provides ANY relevant information about their business (even just a name and description is sufficient)
                - The user makes a genuine effort to respond to the question
                
                IMPORTANT: Err on the side of marking responses as ON-TOPIC. Only mark as OFF-TOPIC 
                if the user is genuinely confused or asking for help.
            </task>

            ${chatHistory}

            ${formatInstructions}
        `);

        const llm = getLlm(LLMSkill.Planning, LLMSpeed.Fast);
        const structuredLlm = llm.withStructuredOutput(brainstormGuardrailPromptOutputSchema);
        const result = await structuredLlm.invoke(promptText);

        return { 
            userNeedsHelp: !result.isOnTopic,
        };
    }
}
