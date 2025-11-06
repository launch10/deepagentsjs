import { z } from "zod";
import { createAgent } from "langchain";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { Message } from "@langchain/core/messages";
import { checkpointer, getLLM } from "@core";
import { renderPrompt, chatHistoryPrompt, toJSON } from "@prompts";
import { isHumanMessage } from "@types";
import { tool, Tool } from "@langchain/core/tools";
import { type WebsiteType } from "@types";
import { db, brainstorms as brainstormsTable, websiteFiles } from "@db";
import { config } from "process";

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

    const [chatHistory] = await Promise.all([
        chatHistoryPrompt({ messages: state.messages }),
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
                - If answer is off-topic/confused → call clarification
                - If user asks for help → call clarification
                - If no remaining topics → call finish_brainstorming
                - Otherwise → call ask_question for next topic
            </decide_next_action>

            <users_last_message>
                ${lastHumanMessage.content}
            </users_last_message>

            <workflow>
                1. Save any unsaved answers
                2. Decide next action based on user's last message
            </workflow>
        `
    );
}

const SaveAnswersTool = (state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    export async function initSaveAnswers(state: BrainstormGraphState): Promise<Tool> {
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

    return initSaveAnswers;
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

    const response = await createAgent({
        model: getLLM(),
        tools,
        systemPrompt: prompt,
        checkpointer,
    });

    return response;
  }
);
