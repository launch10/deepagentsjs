import { z } from "zod";
import { createAgent } from "langchain";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { Message } from "@langchain/core/messages";
import { checkpointer, getLLM } from "@core";
import { renderPrompt, chatHistoryPrompt, toJSON, structuredOutputPrompt } from "@prompts";
import { isHumanMessage } from "@types";
import { tool, Tool } from "@langchain/core/tools";
import { type WebsiteType } from "@types";
import { db, brainstorms as brainstormsTable, websiteFiles } from "@db";
import { config } from "process";

/**
 * Schema for structured messages with intro, examples, and conclusion
 */
export const structuredQuestionSchema = z.object({
  intro: z.string().describe('A simple intro to the question'),
  examples: z.array(z.string()).describe(`List of examples to help the user understand what we're asking`),
  conclusion: z.string().optional().describe(`Conclusion of the question, restating exactly the information we want to the user to answer`),
});

export type StructuredQuestion = z.infer<typeof structuredQuestionSchema>;

/**
 * Schema for simple text messages
 */
export const simpleQuestionSchema = z.object({
  content: z.string().describe('Simple question to ask the user'),
});

export type SimpleQuestion = z.infer<typeof simpleQuestionSchema>;

export const finishBrainstormingSchema = z.object({
  finishBrainstorming: z.literal(true).describe("Call to signal that the user has finished brainstorming"),
});

export type FinishBrainstorming = z.infer<typeof finishBrainstormingSchema>;

/**
 * Union schema allowing either simple or structured messages
 */
export const outputSchema = z.union([
  simpleQuestionSchema,
  structuredQuestionSchema,
  finishBrainstormingSchema,
]);

export type OutputType = z.infer<typeof outputSchema>;

const brainstormTopics = ["idea", "audience", "solution", "socialProof", "lookAndFeel"] as const;
type BrainstormTopic = typeof brainstormTopics[number];
type Brainstorm = Partial<Record<BrainstormTopic, string>>;
const TopicDescriptions: Record<BrainstormTopic, string> = {
    idea: `The core business idea. What does the business do? What makes them different?`,
    audience: `The target audience. What are their pain points? What are their goals?`,
    solution: `How does the user's business solve the audience's pain points, or help them reach their goals?`,
    socialProof: `Social proof or testimonials to include on the landing page. Remember, anything can be social proof: the user's background, experience, beliefs, founder story, etc.`,
    lookAndFeel: `The look and feel of the landing page.`,
}

interface BrainstormGraphState {
    messages: Message[];
    brainstorm: Brainstorm;
    remainingTopics: BrainstormTopic[];
    website: WebsiteType;
}

const sortedTopics = (topics: BrainstormTopic[]) => {
    return topics.sort((a, b) => brainstormTopics.indexOf(a) - brainstormTopics.indexOf(b));
}

const remainingTopics = (topics: BrainstormTopic[]) => {
    return sortedTopics(topics).map(topic => `${topic}: ${TopicDescriptions[topic]}`).join("\n\n");
}

const collectedData = (state: BrainstormGraphState): Brainstorm => {
    return Object.entries(state.brainstorm).filter(([_, value]) => value !== undefined && value !== "") as Brainstorm;
}

const getPrompt = async (state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const lastHumanMessage = state.messages.filter(isHumanMessage).at(-1);
    if (!lastHumanMessage) {
        throw new Error("No human message found");
    }

    const [chatHistory, outputInstructions] = await Promise.all([
        chatHistoryPrompt({ messages: state.messages }),
        structuredOutputPrompt({ schema: outputSchema })
    ])

    return renderPrompt(
        `
            <role>
                You are an expert marketer and strategist who specializes in helping businesses develop 
                HIGHLY PERSUASIVE marketing copy for their landing pages to differentiate their business ideas.
            </role>

            <task>
                Help the user brainstorm marketing copy for their landing page.
                Guide them through each question until you have enough context to generate effective marketing copy.
            </task>

            <collected_data>
                ${toJSON({ values: collectedData(state) })}
            </collected_data>

            ${chatHistory}

            <remaining_topics>
                ${remainingTopics(state.remainingTopics)}
            </remaining_topics>

            <decide_next_action>
                - If user's last message answered any of the remaining topics → call save_answers
                - If answer is off-topic/confused → provide clarification
                - If user asks for help → provide clarification
                - If no remaining topics → output finish_brainstorming
                - Otherwise → ask the user the next question, using the output format specified below
            </decide_next_action>

            <users_last_message>
                ${lastHumanMessage.content}
            </users_last_message>

            <workflow>
                1. Save any unsaved answers
                2. Decide next action based on user's last message
            </workflow>

            ${outputInstructions}
        `
    );
}

const SaveAnswersTool = (state: BrainstormGraphState, config?: LangGraphRunnableConfig): Promise<Tool> => {
    const websiteId = state?.website?.id;

    const description = `
        Tool for saving answers to the brainstorming session.

        CAPABILITIES:
        • Save multiple answers at once
    `;

    const saveAnswersInputSchema = z.array(z.object({
        topic: z.enum(brainstormTopics),
        answer: z.string()
    }));

    type SaveAnswersInput = z.infer<typeof saveAnswersInputSchema>;

    const SaveAnswersOutputSchema = z.object({
        success: z.boolean(),
    });

    type SaveAnswersOutput = z.infer<typeof SaveAnswersOutputSchema>;

    async function saveAnswers(args?: SaveAnswersInput): Promise<SaveAnswersOutput> {
        const updates: Partial<Brainstorm> = args?.reduce((acc, { topic, answer }) => {
            if (!topic || !answer) {
                return acc;
            }
            acc[topic] = answer;
            return acc;
        }, {} as Record<BrainstormTopic, string>)

        const result = await db.insert(brainstormsTable)
            .values({
                websiteId,
                ...updates
            })
            .onConflictDoUpdate({
                target: websiteId,
                set: updates
            })
            .returning();

        console.log(result);
        
        return {
            success: true
        };
    }
    
    return tool(saveAnswers, {
        name: "saveAnswers",
        description,
        schema: saveAnswersInputSchema,
    });
}

/**
 * Node that asks a question to the user during brainstorming mode
 */
export const brainstormAgent = async (
    state: BrainstormGraphState, 
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> => {
    const prompt = await getPrompt(state, config)
    const tools = await Promise.all([
        SaveAnswersTool
    ].map(tool => tool(state, config)));

    console.log(prompt)
    const agent = await createAgent({
        model: getLLM(),
        tools,
        systemPrompt: prompt,
        checkpointer,
    });
    const response = await agent.invoke(state as any, config);

    console.log(response);

    return {};
}
