import { z } from "zod";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLlm, LLMSkill, LLMSpeed } from "@core";
import { renderPrompt, chatHistoryPrompt, structuredOutputPrompt } from "@prompts";
import { isHumanMessage, isAIMessage, messageSchema } from "@types";

export const brainstormGuardrailInputSchema = z.object({
    messages: z.array(messageSchema).describe("The conversation messages"),
    questionIndex: z.number().describe("The current question index"),
});

export type BrainstormGuardrailInput = z.infer<typeof brainstormGuardrailInputSchema>;

const brainstormGuardrailPromptOutputSchema = z.object({
    isOnTopic: z.boolean().describe("Whether the user's response adequately answers the previous question"),
    reasoning: z.string().describe("Brief explanation of why the response is on-topic or off-topic")
}).strict();

export type BrainstormGuardrailOutput = { 
    userNeedsHelp: boolean; // If not on topic, the user needs help
    reasoning: string;
};

export class BrainstormGuardrailService {
    async execute(input: BrainstormGuardrailInput, config?: LangGraphRunnableConfig): Promise<BrainstormGuardrailOutput> {
        const { messages, questionIndex } = input;
        
        if (!messages || messages.length === 0) {
            return { userNeedsHelp: false, reasoning: "No messages provided" };
        }

        const humanMessages = messages.filter(isHumanMessage)
        const lastHumanMessage = humanMessages[humanMessages.length - 1];

        if (!lastHumanMessage) {
            return { userNeedsHelp: false, reasoning: "No human messages provided" };
        }

        const AIMessages = messages.filter(isAIMessage)
        const lastAIMessage = AIMessages[AIMessages.length - 1];

        if (!lastAIMessage) {
            if (questionIndex !== 0) {
                return { userNeedsHelp: false, reasoning: "No AI messages provided" };
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
                Analyze the conversation history where the AI asked the user a question and the user 
                provided a response. Determine if the user's response adequately answers the question.
                
                CRITICAL: Return ONLY the two required fields: isOnTopic (boolean) and reasoning (string).
                Do NOT include any other fields.
            </task>
            
            <classification_criteria>
                Mark as OFF-TOPIC if the user's response falls into ANY of these categories:
                
                1. **Confusion or clarification requests:**
                - "what?", "I don't understand", "what do you mean?", "huh?"
                - "Can you explain that differently?"
                - "I'm not sure what you're asking"
                
                2. **Procedural confusion:**
                - "What should I do?", "How does this work?"
                - Questions about the process itself
                
                3. **Completely unrelated responses:**
                - Answers that have no connection to the question asked
                - Random topic changes that don't address the question
                
                Mark as ON-TOPIC if the user's response shows ANY of these:
                
                1. **Direct attempt to answer:**
                - Even if brief, incomplete, or vague
                - Even if it's just a business name and basic description
                
                2. **Relevant information provided:**
                - Any details about their business, product, or service
                - Context that relates to the question asked
                
                3. **Genuine engagement:**
                - The user is trying to move the conversation forward
                - Response demonstrates understanding of what was asked
            </classification_criteria>
            
            <decision_framework>
                When uncertain, ask yourself:
                - "Does this response show the user understood the question?" → Likely ON-TOPIC
                - "Can I extract ANY relevant information from this response?" → Likely ON-TOPIC
                - "Is the user asking what to do or saying they're confused?" → OFF-TOPIC
                
                Default to ON-TOPIC when the user makes a reasonable attempt to answer, even if 
                minimal. Only mark as OFF-TOPIC when there's clear confusion or no attempt to 
                address the question.
            </decision_framework>

            <important>
                Be GENEROUS with the user's response. If they made a reasonable attempt to answer,
                even if minimal, mark as ON-TOPIC.
            </important>

            <question>
                ${lastAIMessage?.content}
            </question>

            <answer>
                ${lastHumanMessage?.content}
            </answer>
            
            ${chatHistory}

            ${formatInstructions}
        `);

        const llm = getLlm(LLMSkill.Planning, LLMSpeed.Slow);
        const structuredLlm = llm.withStructuredOutput(brainstormGuardrailPromptOutputSchema);
        const result = await structuredLlm.invoke(promptText);

        return {
            userNeedsHelp: !result.isOnTopic,
            reasoning: result.reasoning
        }
    }
}
