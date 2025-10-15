import { z } from "zod";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLlm, LLMSkill, LLMSpeed } from "@core";
import { renderPrompt, chatHistoryPrompt, structuredOutputPrompt } from "@prompts";
import { BaseMessage } from "@langchain/core/messages";

export const checkResponseInputSchema = z.object({
    messages: z.array(z.any()).describe("The conversation messages"),
    questionIndex: z.number().describe("The current question index"),
});

export type CheckResponseInput = z.infer<typeof checkResponseInputSchema>;

const responseCheckSchema = z.object({
    isOnTopic: z.boolean().describe("Whether the user's response adequately answers the previous question"),
    reasoning: z.string().describe("Brief explanation of why the response is on-topic or off-topic")
});

export type CheckResponseOutput = { 
    isOnTopic: boolean;
    useHelpfulVariant: boolean;
};

export class CheckResponseService {
    async execute(input: CheckResponseInput, config?: LangGraphRunnableConfig): Promise<CheckResponseOutput> {
        const { messages, questionIndex } = input;
        
        if (!messages || messages.length === 0) {
            return { isOnTopic: true, useHelpfulVariant: false };
        }

        const lastUserMessage = messages[messages.length - 1];

        if (!lastUserMessage || lastUserMessage.getType?.() !== 'human') {
            return { isOnTopic: true, useHelpfulVariant: false };
        }

        const previousAIMessage = messages.length >= 2 ? messages[messages.length - 2] : null;

        if (!previousAIMessage || previousAIMessage.getType?.() !== 'ai') {
            if (questionIndex !== 0) {
                return { isOnTopic: true, useHelpfulVariant: false };
            }
        }

        const baseMessages = messages.filter((msg): msg is BaseMessage => msg instanceof BaseMessage || (msg.getType && typeof msg.getType === 'function'));
        
        const [chatHistory, formatInstructions] = await Promise.all([
            chatHistoryPrompt({ messages: baseMessages }),
            structuredOutputPrompt({ schema: responseCheckSchema })
        ]);

        const promptText = await renderPrompt(`
            <role>
                You are a response validator for a brainstorming conversation about landing pages.
            </role>

            <task>
                Look at the conversation history. The AI asked the user a question, and the user 
                provided a response. Determine if the user's response adequately answers the 
                question that was asked.
                
                A response is OFF-TOPIC if:
                - The user is asking for help or clarification ("what?", "I don't understand", "what do you mean?")
                - The user is confused about what to do
                - The user's response is completely unrelated to the question
                - The user provides a vague or non-answer response
                
                A response is ON-TOPIC if:
                - The user attempts to answer the question, even if brief
                - The user provides relevant information about their business
            </task>

            ${chatHistory}

            ${formatInstructions}
        `);

        const llm = getLlm(LLMSkill.Planning, LLMSpeed.Fast);
        const structuredLlm = llm.withStructuredOutput(responseCheckSchema);
        const result = await structuredLlm.invoke(promptText);


        return { 
            isOnTopic: result.isOnTopic,
            useHelpfulVariant: !result.isOnTopic 
        };
    }
}
