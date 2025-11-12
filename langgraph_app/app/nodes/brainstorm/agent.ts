import { AIMessage } from "@langchain/core/messages";
import { createAgent, createMiddleware, DynamicStructuredTool } from "langchain";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@core";
import { toJSON, renderPrompt, chatHistoryPrompt, toolHistoryPrompt, structuredOutputPrompt, structuredOutputPrompt } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { SaveAnswersTool } from "@tools";
import { pick, compactObject } from "@utils";
import {
  isHumanMessage,
  Brainstorm,
} from '@types';
import { type BrainstormGraphState, brainstormStateSchema } from "@state";
import { db, eq, asc, brainstorms as brainstormsTable } from "@db";
import { BrainstormAnnotation } from "@annotation";
import z from "zod";
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
            memories: memories as Brainstorm.MemoriesType,
            placeholderText: placeholderText as string,
            currentTopic: currentTopic as Brainstorm.TopicType,
            remainingTopics: remainingTopics as Brainstorm.TopicType[],
            availableActions: availableActions as Brainstorm.ActionType[],
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

const uiGuidancePrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const [chatHistory, outputInstructions] = await Promise.all([
        chatHistoryPrompt({ messages: state.messages }),
        structuredOutputPrompt({ schema: Brainstorm.questionSchema }),
    ]);
    return `
        The user has completed the brainstorming questions.

        They now have access to a Brand Personalization panel they can use before we build their page.

        Or they can use the "Build My Site" button to start building their page right away!

        Great, now that we have your core idea, let's start personalizing the look and feel of your page.
        On the left side of your screen, you'll see the Brand Personalization panel. This is where you can add visual elements to make the project uniquely yours. All of these steps are completely optional, so feel free to skip any you're not ready for.
        Here’s a quick guide:
        Logo: You can upload your brand's logo here. Just drag and drop a PNG, JPG, or SVG file into the box, or click on it to select a file from your computer. We'll use this as the main logo for your page.
        Colors: Choose a color palette that fits your brand. You can click through the pre-defined schemes we've provided or select "+ Add Custom" to create your very own color palette.
        Social Links: If you have social media pages like Twitter, Instagram, or YouTube, you can add the links here. We'll often use these to create icons in the footer of your page so visitors can easily find you.
        Images: Have any specific photos or graphics you'd like us to use? You can upload them in the "Images" section. This helps us incorporate your preferred visuals directly into the design.
        Take your time to fill out as much or as little as you'd like. When you're ready, we can move on to the next question.

        These are the tools available to them. Continue the conversation, but be sure to mention the available next steps (Brand Personalization, Build My Site).

        ${chatHistory}

        ${outputInstructions}
    `
}

const conversationalPrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const lastHumanMessage = state.messages.filter(isHumanMessage).at(-1);
    if (!lastHumanMessage) {
        throw new Error("No human message found");
    }

    const [chatHistory, toolHistory, nextSteps, outputInstructions] = await Promise.all([
        chatHistoryPrompt({ messages: state.messages }),
        toolHistoryPrompt({ messages: state.messages }),
        new BrainstormNextSteps(state).nextSteps(),
        structuredOutputPrompt({ schema: Brainstorm.questionSchema }),
    ]);

    const memories = compactObject(nextSteps.memories);
    const currentTopic = nextSteps.currentTopic;
    const remainingTopicKeys = nextSteps.remainingTopics;

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
                ${remainingTopics(remainingTopicKeys)}
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

            ${toolHistory}

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

            ${outputInstructions}
        `
    );
    
}

const getPrompt = async (state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    // Get current topic to determine available tools
    const nextSteps = await new BrainstormNextSteps(state).nextSteps();
    const currentTopic = nextSteps.currentTopic;

    if (Brainstorm.TopicKindMap[currentTopic] === "conversational") {
        return conversationalPrompt(state, config);
    }

    return uiGuidancePrompt(state, config);
}

// This is going to help us dynamically allocate tools and switch the system
// prompt based on the current topic
const brainstormMiddleware = createMiddleware({
    name: "BrainstormMiddleware",
    stateSchema: brainstormStateSchema,
    wrapModelCall: async (request, handler) => {
        const state = request.state satisfies BrainstormGraphState;

        // Get current topic to determine available tools
        const nextSteps = await new BrainstormNextSteps(state).nextSteps();
        const currentTopic = nextSteps.currentTopic;

        // Regenerate system prompt with current state
        const systemPrompt = await getPrompt(state, request.runtime);

        console.log(`we have modified the system prompt for ${currentTopic}`)
        console.log(systemPrompt);
        // Return modified request
        const result = await handler({
            ...request,
            systemPrompt,
        });
        console.log(result)
        if (result instanceof AIMessage) {
            return result
        }
        const structuredResponse = result.structuredResponse

        const aiMessage = new AIMessage({
            content: JSON.stringify(structuredResponse, null, 2),
            response_metadata: structuredResponse,
        });
        return aiMessage
    },
});


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
      const llm = getLLM().withConfig({ tags: ['notify'] }) // Important so messages are sent to frontend
      const tools = [SaveAnswersTool(state, config)];

      const agent = await createAgent({
          model: llm,
          tools,
          middleware: [brainstormMiddleware],
          responseFormat: Brainstorm.questionSchema,
      });
      const result = await agent.invoke(state, config);
      const aiMessage = result.messages.at(-1);

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