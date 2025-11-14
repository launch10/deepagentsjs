import { AIMessage } from "@langchain/core/messages";
import { createAgent, createMiddleware } from "langchain";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@core";
import { agentPrompt } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { saveAnswersTool, finishedTool } from "@tools";
import {
  Brainstorm,
} from '@types';
import { type BrainstormGraphState } from "@state";
import z from "zod";
import { BrainstormNextStepsService } from "@services";

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
        const state = request.state as BrainstormGraphState;

        // Get current topic to determine available tools
        const nextSteps = await new BrainstormNextStepsService(state).nextSteps();
        const currentTopic = nextSteps.currentTopic;

        // Regenerate system prompt with current state
        const systemPrompt = await agentPrompt(state, request.runtime);

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
        responseFormat: [
            Brainstorm.replySchema,
            Brainstorm.helpMeSchema,
        ] as const,
    });
    const result = await agent.invoke(state, config);
    const aiMessage = result.messages.at(-1);

    if (!aiMessage) {
        throw new Error("No AI message found");
    }

    const { memories, remainingTopics, currentTopic, placeholderText, availableCommands } = await new BrainstormNextStepsService(state).nextSteps();

    return {
        redirect: result.redirect as Brainstorm.RedirectType,
        skippedTopics: (result.skippedTopics || []) as Brainstorm.TopicName[],
        messages: [...(state.messages || []), aiMessage],
        memories,
        currentTopic,
        placeholderText,
        remainingTopics,
        availableCommands,
    };
});