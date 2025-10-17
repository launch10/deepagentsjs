import { Schema, string, z } from "zod";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLlm, LLMSkill, LLMSpeed } from "@core";
import { renderPrompt, chatHistoryPrompt, structuredOutputPrompt } from "@prompts";
import { isHumanMessage, isAIMessage, messageSchema, Brainstorm, type Message } from "@types";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { PromptTemplate } from "@langchain/core/prompts";
import { lastAIMessage } from "@annotation";

export const brainstormGuardrailInputSchema = z.object({
    messages: z.array(messageSchema).describe("The conversation messages"),
    questionIndex: z.number().describe("The current question index"),
});

export type BrainstormGuardrailInput = z.infer<typeof brainstormGuardrailInputSchema>;

export type GuardrailPrompt<Schema extends z.ZodObject<any>> = (
  lastAiMessage: AIMessage,
  lastHumanMessage: HumanMessage,
  messages: Message[],
  schema: Schema
) => Promise<string>;

const guardrailPromptFactory = <S extends z.ZodObject<any>>(prompt: string): GuardrailPrompt<S> => {
    return async (lastAiMessage: AIMessage, lastHumanMessage: HumanMessage, messages: Message[], schema: S): Promise<string> => {
        const [chatHistory, formatInstructions] = await Promise.all([
            chatHistoryPrompt({ messages: messages }),
            structuredOutputPrompt({ schema: schema })
        ]);
        return PromptTemplate.fromTemplate(prompt).format({
            lastAiMessage: lastAiMessage.content,
            lastHumanMessage: lastHumanMessage.content,
            chatHistory: chatHistory,
            formatInstructions: formatInstructions
        })
    }
}

const makeGuardrail = async <Schema extends z.ZodObject<any>>(
    makePrompt: GuardrailPrompt<Schema>, 
    lastAIMessage: AIMessage,
    lastHumanMessage: HumanMessage,
    messages: Message[],
    schema: Schema,
): Promise<Schema> => {
    const promptText = await makePrompt(lastAIMessage, lastHumanMessage, messages, schema)
    const llm = getLlm(LLMSkill.Planning, LLMSpeed.Slow);
    const response = await llm.invoke(promptText)

    // For plane, remove this... annoying
    // const structuredLlm = llm.withStructuredOutput(brainstormGuardrailPromptOutputSchema);
    // const result = await structuredLlm.invoke(promptText);
    const jsonPieces = response.content.split("```json")
    const jsonString = jsonPieces[1].replace(/```/, '');
    const result: Schema = JSON.parse(jsonString);

    return result as Schema;
}

const isValidAnswerPromptOutputSchema = z.object({
    isValidAnswer: z.boolean().describe("Whether the user's response adequately answers the previous question"),
    reasoning: z.string().describe("Brief explanation of why the response is on-topic or off-topic")
}).strict();

export type BrainstormGuardrailOutput = { 
    route?: string; // Does user need more explicit help?
    reasoningRoute?: string;
    isValidAnswer?: boolean; // Did user provide valid answer?
    reasoningIsValidAnswer?: string;
};

const validAnswerPrompt = guardrailPromptFactory<typeof isValidAnswerPromptOutputSchema>(
    `
        <role>
            You are a response validator for a brainstorming conversation about landing pages.
        </role>
        
        <task>
            Analyze the conversation history where the AI asked the user a question and the user 
            provided a response. Determine if the user's response adequately answers the question.
            
            CRITICAL: Return ONLY the two required fields: isValidAnswer (boolean) and reasoning (string).
            Do NOT include any other fields.
        </task>
        
        <classification_criteria>
            Mark as INVALID ANSWER if the user's response falls into ANY of these categories:
            
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
            
            Mark as VALID ANSWER if the user's response shows ANY of these:
            
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
            - "Does this response show the user understood the question?" → Likely VALID ANSWER
            - "Can I extract ANY relevant information from this response?" → Likely VALID ANSWER
            - "Is the user asking what to do or saying they're confused?" → INVALID ANSWER
            
            Default to VALID ANSWER when the user makes a reasonable attempt to answer, even if 
            minimal. Only mark as INVALID ANSWER when there's clear confusion or no attempt to 
            address the question.
        </decision_framework>

        <important>
            Be GENEROUS with the user's response. If they made a reasonable attempt to answer,
            even if minimal, mark as VALID.
        </important>

        <question>
            {lastAIMessage}
        </question>

        <answer>
            {lastHumanMessage}
        </answer>
        
        {chatHistory}

        {formatInstructions}
    `
);

export const AvailableRoutes = z.enum([
  "ui_help",
  "proceed_to_page_builder",
  "keep_brainstorming",
] as const);
export type AvailableRoute = z.infer<typeof AvailableRoutes>;

const routerPromptOutputSchema = z.object({
    route: AvailableRoutes.describe("Where should we route the user to next? Which model should answer their question?"),
    reasoning: z.string().describe("Brief explanation of why this route was selected")
}).strict();

const routerPrompt = guardrailPromptFactory<typeof routerPromptOutputSchema>(
    `
        <background>
            You and the user have been having a conversation about a landing page they want to build.

            The user has finished all Q&A steps, and now has 3 options:

            Option 1) Use the UI to provide color palette, logos, and other images.
            Option 2) Proceed to building the landing page
            Option 3) Continue providing background for the landing page design
        </background>

        <role>
            You are the User Intent Router. Your job is to determine what the user wants to do next.
        </role>
        
        <task>
            Analyze the conversation history, and specifically analyze the user's latest message, and determine which
            route matches their intent.
        </task>
        
        <classification_criteria>
            Mark as ui_help if:
            
            1. **The user is asking you to upload images, color palettes, or logos**
            
            2. **The user seems to be asking you where or how to upload images, color palettes, or logos, based on conversation history**
            
            3. **The user is asking what to do:**
            
            Mark as proceed_to_page_builder if:
            
            1. **User has stated they're finished, or ready to move on:**
            
            2. **User is asking "What now" or similar:**
            
            3. **User seems aggravated or unclear what's happening:**

            Mark as keep_brainstorming if:

            1. The user appears to be continuing the previous conversation about their landing page
            2. The user doesn't seem to be engaging in conversation about logos, images, or color palettes.
        </classification_criteria>
        
        <question>
            {lastAIMessage}
        </question>

        <answer>
            {lastHumanMessage}
        </answer>
        
        {chatHistory}

        {formatInstructions}
    `
);

const guardrailPrompts: Record<Brainstorm.QuestionGuardrail, GuardrailPrompt<any>> = {
    validAnswer: validAnswerPrompt,
    router: routerPrompt
}

const guardrailSchemas: Record<Brainstorm.QuestionGuardrail, z.ZodObject<any>> = {
    validAnswer: isValidAnswerPromptOutputSchema,
    router: routerPromptOutputSchema
}
export class BrainstormGuardrailService {
    async execute(input: BrainstormGuardrailInput, config?: LangGraphRunnableConfig): Promise<BrainstormGuardrailOutput> {
        const { messages, questionIndex } = input;
        
        if (!messages || messages.length === 0) {
            return { isValidAnswer: true, reasoningIsValidAnswer: "No messages provided" };
        }

        const humanMessages = messages.filter(isHumanMessage)
        const lastHumanMessage = humanMessages[humanMessages.length - 1];

        if (!lastHumanMessage) {
            return { isValidAnswer: true, reasoningIsValidAnswer: "No human messages provided" };
        }

        const AIMessages = messages.filter(isAIMessage)
        const lastAIMessage = AIMessages[AIMessages.length - 1];

        if (!lastAIMessage) {
            if (questionIndex !== 0) {
                return { isValidAnswer: true, reasoningIsValidAnswer: "No AI messages provided" };
            }
        }

        const nextQuestion = Brainstorm.Questions[questionIndex + 1];

        if (!nextQuestion) {
            throw new Error("No question found")
        }
        const guardrailTypes: Brainstorm.QuestionGuardrail[] = nextQuestion.guardrails
        const guardrails = Promise.all(
            guardrailTypes.map(async (guardrail: Brainstorm.QuestionGuardrail) => {
                const prompt = guardrailPrompts[guardrail];
                const schema = guardrailSchemas[guardrail];
                return await makeGuardrail(prompt, lastAIMessage, lastHumanMessage, messages, schema)
            })
        )

        // const [chatHistory, formatInstructions] = await Promise.all([
        //     chatHistoryPrompt({ messages: messages }),
        //     structuredOutputPrompt({ schema: brainstormGuardrailPromptOutputSchema })
        // ]);

        // const llm = getLlm(LLMSkill.Planning, LLMSpeed.Slow);
        // const response = await llm.invoke(promptText)
        // console.log(promptText)

        // // For plane, remove this... annoying
        // // const structuredLlm = llm.withStructuredOutput(brainstormGuardrailPromptOutputSchema);
        // // const result = await structuredLlm.invoke(promptText);
        // const jsonPieces = response.content.split("```json")
        // const jsonString = jsonPieces[1].replace(/```/, '');
        // const result = JSON.parse(jsonString);
        // console.log(result)

        return {
            userNeedsHelp: !result.isOnTopic,
            reasoning: result.reasoning
        }
    }
}
