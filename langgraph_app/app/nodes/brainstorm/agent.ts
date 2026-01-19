import { createAgent, createMiddleware } from "langchain";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { type BaseMessage } from "@langchain/core/messages";
import { getLLM } from "@core";
import { chooseBrainstormPrompt } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { saveAnswersTool, finishedTool, queryUploadsTool } from "@tools";
import { Brainstorm } from "@types";
import { type BrainstormGraphState } from "@state";
import z from "zod";
import { BrainstormNextStepsService } from "@services";
import { toStructuredMessage } from "langgraph-ai-sdk";
import { lastAIMessage } from "@types";
import { BrainstormBridge } from "@annotation";
import { filterPseudoMessages } from "@utils";

const dynamicPromptMiddleware = createMiddleware({
  name: "DynamicPromptMiddleware",
  stateSchema: z.object({
    brainstormId: z.number(),
    websiteId: z.number(),
    projectId: z.number(),
    currentTopic: z.string().optional(),
    skippedTopics: z.array(z.string()).optional(),
    redirect: z.string().optional(),
    availableCommands: z.array(z.string()).default([]),
    command: z.string().optional(),
    jwt: z.string().optional(),
  }),
  wrapModelCall: async (request, handler) => {
    const state = request.state as BrainstormGraphState;

    // Regenerate system prompt with current state
    const systemPrompt = await chooseBrainstormPrompt(state, request.runtime);

    // Return modified request
    return await handler({
      ...request,
      systemPrompt,
    });
  },
});

/**
 * Node that asks a question to the user during brainstorming mode.
 * Images are received as inline image_url content blocks in messages
 */
export const brainstormAgent = NodeMiddleware.use(
  {},
  async (
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> => {
    if (!state.websiteId) {
      throw new Error("websiteId is required");
    }

    const llm = (await getLLM({})).withConfig({ tags: ["notify"] });
    const tools = [saveAnswersTool, finishedTool, queryUploadsTool];

    const agent = await createAgent({
      model: llm,
      tools,
      middleware: [dynamicPromptMiddleware],
    });
    const result = (await agent.invoke(state as any, config)) as BrainstormGraphState;
    const lastMessage = lastAIMessage(result);
    if (!lastMessage) {
      throw new Error("Agent did not return an AI message");
    }

    const [message, updates] = await BrainstormBridge.toStructuredMessage(lastMessage);
    const { memories, remainingTopics, currentTopic, placeholderText, availableCommands } =
      await new BrainstormNextStepsService(state).nextSteps();

    let messages = state.messages || [];

    // Preserve all new messages from the agent result except the last AI message
    // (which we'll add as a processed version below). This ensures tool calls have
    // their corresponding AIMessage with tool_use preserved alongside ToolMessages.
    const resultMessages = (result as any).messages || [];
    const originalMessageCount = (state.messages || []).length;
    const newMessages = resultMessages.slice(originalMessageCount);

    // Add all new messages except the last one (which is the final AI message we'll process)
    if (newMessages.length > 1) {
      const intermediateMessages = newMessages.slice(0, -1);
      messages = [...(messages as any[]), ...intermediateMessages];
    }

    if (message) {
      // Tag the AI message with the current topic for frontend question badge display
      message.additional_kwargs = {
        ...message.additional_kwargs,
        currentTopic,
      };
      messages = [...(messages as any[]), message];
    }

    // Filter out pseudo messages before saving to history
    // These are injected by tools for model vision but shouldn't appear in chat
    const filteredMessages = filterPseudoMessages(messages as BaseMessage[]);

    return {
      redirect: result.redirect as Brainstorm.RedirectType,
      skippedTopics: (result.skippedTopics || []) as Brainstorm.TopicName[],
      messages: filteredMessages,
      memories,
      currentTopic,
      remainingTopics,
      placeholderText,
      availableCommands,
    };
  }
);
