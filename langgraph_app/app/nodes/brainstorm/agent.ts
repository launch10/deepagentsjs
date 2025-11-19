import { AIMessage } from "@langchain/core/messages";
import { createAgent, createMiddleware } from "langchain";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@core";
import { chooseAgentPrompt } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { saveAnswersTool, finishedTool } from "@tools";
import {
  Brainstorm,
} from '@types';
import { type BrainstormGraphState } from "@state";
import z from "zod";
import { BrainstormNextStepsService } from "@services";
import { toStructuredMessage } from "langgraph-ai-sdk";
import { lastAIMessage } from "@types";

// This is going to help us dynamically allocate tools and switch the system
// prompt based on the current topic
const brainstormMiddleware = createMiddleware({
    name: "BrainstormMiddleware",
    stateSchema: z.object({
        brainstormId: z.number(),
        websiteId: z.number(),
        projectId: z.number(),
        currentTopic: z.string().optional(),
        skippedTopics: z.array(z.string()).optional(),
        redirect: z.string().optional(),
        availableCommands: z.array(z.string()).default([]),
        command: z.string().optional()
    }),
    wrapModelCall: async (request, handler) => {
        const state = request.state as BrainstormGraphState;

        // Regenerate system prompt with current state
        const systemPrompt = await chooseAgentPrompt(state, request.runtime);

        // Return modified request
        const result = await handler({
            ...request,
            systemPrompt,
        });

        return await toStructuredMessage(result as any) as any;
    },
})

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
    });
    const result = await agent.invoke(state as any, config) as BrainstormGraphState;
    const lastMessage = lastAIMessage(result);
    const structuredMessage = await toStructuredMessage(lastMessage as any);

    if (!lastMessage) {
        throw new Error("Agent did not return an AI message");
    }

    const { memories, remainingTopics, currentTopic, placeholderText, availableCommands } = await new BrainstormNextStepsService(state).nextSteps();

    return {
        redirect: result.redirect as Brainstorm.RedirectType,
        skippedTopics: (result.skippedTopics || []) as Brainstorm.TopicName[],
        messages: [...state.messages, structuredMessage],
        memories,
        currentTopic,
        remainingTopics,
        placeholderText,
        availableCommands,
    };
});