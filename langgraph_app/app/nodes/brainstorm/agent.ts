import { AIMessage } from "@langchain/core/messages";
import { createAgent, createMiddleware, DynamicStructuredTool, tool, ToolMessage } from "langchain";
import { getCurrentTaskInput, type LangGraphRunnableConfig, Command } from "@langchain/langgraph";
import { getLLM } from "@core";
import { toJSON, renderPrompt, chatHistoryPrompt, toolHistoryPrompt, structuredOutputPrompt, toolsPrompt } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { saveAnswersTool } from "@tools";
import { pick, compactObject } from "@utils";
import {
  isHumanMessage,
  Brainstorm,
} from '@types';
import { type BrainstormGraphState } from "@state";
import { db, eq, asc, brainstorms as brainstormsTable } from "@db";
import { BrainstormAnnotation, lastHumanMessage } from "@annotation";
import z from "zod";
import { BrainstormNextStepsService } from "@services";

const conversationalPrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const lastHumanMessage = state.messages.filter(isHumanMessage).at(-1);
    if (!lastHumanMessage) {
        throw new Error("No human message found");
    }

    const [nextSteps, outputInstructions] = await Promise.all([
        new BrainstormNextStepsService(state).nextSteps(),
        structuredOutputPrompt({ schema: Brainstorm.questionSchema }),
    ]);

    const memories = compactObject(nextSteps.memories);
    const currentTopic = nextSteps.currentTopic;
    const remainingTopicKeys = nextSteps.remainingTopics;

    let behavior: Brainstorm.AgentBehaviorType = state.command || "default"

    if (behavior === "helpMe") {
        return await helpMePrompt(state, config);
    }

    return renderPrompt(
        `
            <where_we_are>
                Right now, we're in the brainstorming phase. After we fully flesh out the user's
                business idea, we can move on to the landing page design phase.
            </where_we_are>

            <role>
                You are a highly paid marketing consultant and strategist who specializes in helping businesses develop 
                HIGHLY PERSUASIVE marketing copy for their landing pages to differentiate their business ideas.

                You've been enlisted to lead this brainstorming session.
            </role>

            <rules_for_brainstorming>
                1. You MUST understand the user's business idea and audience. You are good natured, but critical of bad ideas. You MUST help the user find a GREAT angle.
                2. You have a reputation to uphold. You won't accept a bad business idea, but will help the user find a better angle.
                3. If the user is struggling, you can find creative angles to answer a question.
                4. You do not save an answer unless the user has given you a GREAT response. Continue refining UNTIL the user has given you a GREAT response in their own words.
           </rules_for_brainstorming>

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

            <users_last_message important="this is what you should focus on. did they answer the current topic of ${currentTopic}? did they give you a great response?">
                ${lastHumanMessage.content}
            </users_last_message>

            <current_topic>
                ${currentTopic}
            </current_topic>

            <skippable>
                ${Brainstorm.topicIsSkippable(currentTopic) ? "topic is skippable" : "topic is NOT skippable. encourage the user to think creatively, and give them examples of what good looks like"}
            </skippable>

            <skipped_topics important="this is the list of topics that have been skipped, don't bother asking about them">
                ${state.skippedTopics?.join(", ") || "none"}
            </skipped_topics>

            <output_format_rules>
                IMPORTANT: Your response MUST be in this exact format:

                {
                  "text": "Brief intro to the question",
                  "examples": ["Example 1", "Example 2", "Example 3"], // Optional
                  "conclusion": "Restate what you're asking for" // Optional
                }

                You MUST output valid JSON in this format.
            </output_format_rules>

            ${outputInstructions}
        `
    );
}

const getPrompt = async (state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    // Get current topic to determine available tools
    const nextSteps = await new BrainstormNextStepsService(state).nextSteps();
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
    stateSchema: z.object({
        brainstormId: z.number(),
        websiteId: z.number(),
        projectId: z.number(),
        currentTopic: z.string(),
        skippedTopics: z.array(z.string()).optional(),
        redirect: z.string().optional(),
        availableCommands: z.array(z.string()).default([]),
        command: z.string().optional()
    }),
    wrapModelCall: async (request, handler) => {
        const state = request.state satisfies BrainstormGraphState;

        // Get current topic to determine available tools
        const nextSteps = await new BrainstormNextStepsService(state).nextSteps();
        const currentTopic = nextSteps.currentTopic;

        // Regenerate system prompt with current state
        const systemPrompt = await getPrompt(state, request.runtime);

        // Return modified request
        const result = await handler({
            ...request,
            systemPrompt,
        });
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

    // Now invoke agent with updated state
    const llm = getLLM().withConfig({ tags: ['notify'] })
    const tools = [saveAnswersTool, finishedTool];

    const agent = await createAgent({
        model: llm,
        tools,
        middleware: [brainstormMiddleware],
        responseFormat: Brainstorm.questionSchema,
    });
    const result = await agent.invoke(state, config);
    const aiMessage = result.messages.at(-1);

    if (!aiMessage) {
        throw new Error("No AI message found");
    }

    const { memories, remainingTopics, currentTopic, placeholderText, availableCommands } = await new BrainstormNextStepsService(state).nextSteps();

    return {
        redirect: result.redirect as Brainstorm.RedirectType,
        messages: [...(state.messages || []), aiMessage],
        memories,
        currentTopic,
        placeholderText,
        remainingTopics,
        availableCommands,
    };
});