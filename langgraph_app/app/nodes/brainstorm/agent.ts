import { AIMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@core";
import { toJSON, renderPrompt, chatHistoryPrompt, structuredOutputPrompt } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { SaveAnswersTool } from "@tools";
import { pick, compactObject } from "@utils";
import {
  isHumanMessage,
  Brainstorm,
} from '@types';
import { type BrainstormGraphState } from "@state";
import { db, eq, asc, brainstorms as brainstormsTable } from "@db";
export class BrainstormNextSteps {
    state: BrainstormGraphState;
    memories: Brainstorm.MemoriesType | undefined;
    currentTopic: Brainstorm.TopicType | undefined;
    placeholderText: string | undefined;
    remainingTopics: Brainstorm.TopicType[] | undefined;
    availableActions: Brainstorm.ActionType[] | undefined;

    constructor(state: BrainstormGraphState) {
        this.state = state;
    }

    async nextSteps() {
        const memories = await this.getMemories();
        const placeholderText = await this.getPlaceholderText();
        const currentTopic = await this.getCurrentTopic();
        const remainingTopics = await this.getRemainingTopics();
        const availableActions = await this.getAvailableActions();

        return {
            memories,
            placeholderText,
            currentTopic,
            remainingTopics,
            availableActions,
        }
    }

    async getMemories(): Promise<Brainstorm.MemoriesType> {
        if (this.memories) {
            return this.memories;
        }

        if (!this.state.websiteId) {
            throw new Error("websiteId is required");
        }
        const brainstorms = (await db.select().from(brainstormsTable).where(
                eq(brainstormsTable.websiteId, this.state.websiteId)
        ).orderBy(asc(brainstormsTable.id)))[0];
        let memories: Brainstorm.MemoriesType = {}
        if (brainstorms) {
            memories = pick(brainstorms, [...Brainstorm.BrainstormTopics]);
        }
        this.memories = memories;
        return memories;
    }


    private async getRemainingTopics() {
        if (this.remainingTopics) {
            return this.remainingTopics;
        }
        const answers = await this.getMemories();
        const questionsAnswered = Object.keys(answers).filter(key => answers[key as Brainstorm.TopicType] !== null && answers[key as Brainstorm.TopicType] !== "") as Brainstorm.TopicType[];
        const topics = Brainstorm.BrainstormTopics;
        const remainingTopics = topics.filter(topic => !questionsAnswered.includes(topic));
        this.remainingTopics = remainingTopics;
        return remainingTopics;
    }

    private async getCurrentTopic() {
        if (this.currentTopic) {
            return this.currentTopic;
        }
        this.currentTopic = (await this.getRemainingTopics()).at(0);
        return this.currentTopic;
    }

    private async getPlaceholderText() {
        if (this.placeholderText) {
            return this.placeholderText;
        }
        const currentTopic = await this.getCurrentTopic();
        this.placeholderText = currentTopic ? Brainstorm.PlaceholderText[currentTopic] : "";
        return this.placeholderText;
    }

    private async getAvailableActions(): Promise<Brainstorm.ActionType[]> {
        if (this.availableActions) {
            return this.availableActions;
        }
        const currentTopic = await this.getCurrentTopic();
        if (!currentTopic) {
            return ["finished"];
        }
        this.availableActions = Brainstorm.AvailableActions[currentTopic];
        return this.availableActions;
    }
}

const sortedTopics = (topics: Brainstorm.TopicType[]) => {
    return topics.sort((a, b) => Brainstorm.BrainstormTopics.indexOf(a) - Brainstorm.BrainstormTopics.indexOf(b));
}

const remainingTopics = (topics: Brainstorm.TopicType[]) => {
    return sortedTopics(topics).map(topic => `${topic}: ${Brainstorm.TopicDescriptions[topic]}`).join("\n\n");
}

const getPrompt = async (state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const lastHumanMessage = state.messages.filter(isHumanMessage).at(-1);
    if (!lastHumanMessage) {
        throw new Error("No human message found");
    }

    const [chatHistory, nextSteps] = await Promise.all([
        chatHistoryPrompt({ messages: state.messages }),
        new BrainstormNextSteps(state).nextSteps(),
    ]);

    const memories = compactObject(nextSteps.memories);
    const currentTopic = nextSteps.currentTopic;

    return renderPrompt(
        `
            <role>
                You are a highly paid marketing consultant and strategist who specializes in helping businesses develop HIGHLY PERSUASIVE marketing copy for their landing pages to differentiate their business ideas.
            </role>

            <rules>
                1. You MUST understand the user's business idea and audience. You are good natured, but critical of bad ideas. You MUST help the user find a GREAT angle.
                2. You have a reputation to uphold. You won't accept a bad business idea, but will help the user find a better angle.
                3. If the user is struggling, you can find creative angles to answer a question.
                4. You do not save an answer unless the user has given you a GREAT response. Continue refining UNTIL the user has given you a GREAT response in their own words.
            </rules>

            <task>
                Help the user brainstorm marketing copy for their landing page.
                Guide them through each question until you have enough context to generate effective marketing copy.
            </task>

            <collected_answers>
                ${Object.keys(memories).length > 0 ? toJSON(memories) : "none yet"}
            </collected_answers>

            <remaining_topics>
                ${remainingTopics(state.remainingTopics)}
            </remaining_topics>

            <current_topic>
                ${currentTopic}
            </current_topic>

            <be_generous>
                If the user has already provided a thorough, detailed answer, don't ask
                for additional clarification. 
                Only ask for clarification if you can genuinely enrich the user's answer.
            </be_generous>

            <workflow>
                1. If the user has answered any topics with a GREAT response, call the save_answers tool
                2. If they haven't, continue helping them refine their answer until they give you a GREAT response.
                3. Then, if:
                   - The user has answered all topics, output finishBrainstorming
                   - OTHERWISE, ask the next question, following the output_format_rules
            </workflow>

            <important>
                Do not miss anything important the user said! Any important
                business context they give you should be saved to the answers.
            </important>

            ${chatHistory}

            <users_last_message important="this is what you should focus on. did they answer the current topic of ${currentTopic}? did they give you a great response?">
                ${lastHumanMessage.content}
            </users_last_message>

            <current_topic>
                ${currentTopic}
            </current_topic>

            <output_format_rules>
                IMPORTANT: Your response MUST be in one of these exact formats:

                To ask a question:
                {
                  "type": "question",
                  "text": "Brief intro to the question",
                  "examples": ["Example 1", "Example 2", "Example 3"], // Optional
                  "conclusion": "Restate what you're asking for" // Optional
                }

                When the user has finished brainstorming, output:
                {
                  "type": "finishBrainstorming",
                  "finishBrainstorming": true
                }

                You MUST output valid JSON in one of these formats. NO other text.
            </output_format_rules>

            ${await structuredOutputPrompt({ schema: Brainstorm.questionSchema })}
        `
    );
}

/**
 * Node that asks a question to the user during brainstorming mode
 */
export const brainstormAgent = NodeMiddleware.use({}, async (
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> => {
    if (!state.websiteId) {
        throw new Error("websiteId is required");
    }

    try {
      const prompt = await getPrompt(state, config)
      console.log(prompt)
      const tools = [SaveAnswersTool(state, config)];

      // Use structured output for the response format
      const llm = getLLM().withConfig({ tags: ['notify'] }) // Important so messages are sent to frontend

      const agent = await createAgent({
          model: llm,
          tools,
          systemPrompt: prompt,
          responseFormat: Brainstorm.questionSchema,
      });

      const updatedState = await agent.invoke(state as any, config);
      const structuredResponse = updatedState.structuredResponse

      const aiMessage = new AIMessage({
          content: JSON.stringify(structuredResponse, null, 2),
          response_metadata: structuredResponse,
      });

      const { memories, remainingTopics, currentTopic, placeholderText, availableActions } = await new BrainstormNextSteps(state).nextSteps();

      return {
          messages: [...(state.messages || []), aiMessage],
          memories,
          currentTopic,
          placeholderText,
          remainingTopics,
          availableActions,
      };
    } catch (error) {
      console.error('==========================================');
      console.error('BRAINSTORM AGENT ERROR:');
      console.error('==========================================');
      console.error('Error details:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('State:', JSON.stringify(state, null, 2));
      console.error('==========================================');
      throw error; // Re-throw to ensure it propagates
    }
});