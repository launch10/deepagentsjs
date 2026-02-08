import { createAgent, createMiddleware } from "langchain";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { type BaseMessage } from "@langchain/core/messages";
import { getLLM, createPromptCachingMiddleware } from "@core";
import { chooseBrainstormPrompt, getBrainstormContextMessage, getBrainstormMode } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { saveAnswersTool, finishedTool, queryUploadsTool } from "@tools";
import { Brainstorm } from "@types";
import { type BrainstormGraphState, type BrainstormModeType } from "@state";
import z from "zod";
import { BrainstormNextStepsService } from "@services";
import { lastAIMessage } from "@types";
import { BrainstormBridge } from "@annotation";

/**
 * Schema for middleware state - minimal fields needed for mode detection.
 */
const middlewareStateSchema = z.object({
  brainstormId: z.number(),
  websiteId: z.number(),
  projectId: z.number(),
  threadId: z.string().optional(),
  currentTopic: z.string().optional(),
  skippedTopics: z.array(z.string()).optional(),
  redirect: z.string().optional(),
  availableCommands: z.array(z.string()).default([]),
  command: z.string().optional(),
  jwt: z.string().optional(),
});

/**
 * Tracks context messages injected during a turn.
 * The agent must explicitly add these to the returned state.
 */
type MiddlewareTracker = {
  injectedContextMessages: BaseMessage[];
  lastSeenMode: BrainstormModeType | undefined;
};

/**
 * Creates middleware that:
 * 1. Checks for mode switches BEFORE EACH model call (catches mid-turn changes after saveAnswers)
 * 2. Injects context messages when mode switches are detected
 * 3. Regenerates system prompt based on current state
 * 4. Tracks injected messages so the agent can persist them
 *
 * The mode is tracked both in STATE (persists across turns) and locally (for mid-turn switches).
 */
const createBrainstormMiddleware = (
  initialState: BrainstormGraphState,
  tracker: MiddlewareTracker,
  config?: LangGraphRunnableConfig
) => {
  // Initialize tracker with mode from state (persisted across turns)
  tracker.lastSeenMode = initialState.brainstormMode;
  tracker.injectedContextMessages = [];

  return createMiddleware({
    name: "BrainstormMiddleware",
    stateSchema: middlewareStateSchema,
    wrapModelCall: async (request, handler) => {
      // Check current database state BEFORE each model call
      // This catches changes made by tool calls like saveAnswers
      // The middleware state is accessed via request.state
      // Cast to partial BrainstormGraphState since the schema uses generic string types
      const middlewareState = request.state as Partial<BrainstormGraphState>;
      const nextSteps = await new BrainstormNextStepsService({
        websiteId: initialState.websiteId,
        skippedTopics: middlewareState?.skippedTopics || initialState.skippedTopics || [],
      }).nextSteps();

      const currentState: BrainstormGraphState = {
        ...initialState,
        ...middlewareState,
        ...nextSteps,
      };

      // Determine current mode using full mode detection
      const currentMode = getBrainstormMode(currentState);

      // Check for mode switch from last seen mode (handles mid-turn switches)
      const previousMode = tracker.lastSeenMode;
      const hasModeSwitch = previousMode !== undefined && previousMode !== currentMode;

      let messages = request.messages;
      if (hasModeSwitch) {
        // We've switched modes - inject context message
        const contextMessage = await getBrainstormContextMessage(
          currentState,
          currentMode,
          previousMode,
          config
        );
        if (contextMessage) {
          messages = [...messages, contextMessage as unknown as BaseMessage];
          // Track injected message so agent can persist it
          tracker.injectedContextMessages.push(contextMessage as unknown as BaseMessage);
        }
      }

      // Update lastSeenMode for next model call within this turn
      tracker.lastSeenMode = currentMode;

      // Generate the appropriate system prompt based on CURRENT state
      const systemPrompt = await chooseBrainstormPrompt(currentState, config);

      return await handler({
        ...request,
        messages,
        systemPrompt,
      });
    },
  });
};

/**
 * Node that handles brainstorming conversations.
 *
 * Architecture:
 * - brainstormMode is tracked in STATE (persists across turns)
 * - Middleware checks database state BEFORE EACH model call
 * - System prompt is regenerated based on current state (reflects mode changes)
 * - ContextMessage is injected when mode switches are detected
 * - This preserves the switch in traces while keeping the agent informed
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

    // Get initial next steps (state at START of turn)
    const initialNextSteps = await new BrainstormNextStepsService(state).nextSteps();
    const initialState: BrainstormGraphState = {
      ...state,
      ...initialNextSteps,
    };

    // Prepare initial state for agent
    const stateForAgent: BrainstormGraphState = {
      ...initialState,
      messages: state.messages || [],
    };

    // Create tracker to capture context messages injected by middleware
    const middlewareTracker: MiddlewareTracker = {
      injectedContextMessages: [],
      lastSeenMode: state.brainstormMode,
    };

    const llm = (await getLLM({maxTier: 2})).withConfig({ tags: ["notify"] });
    const tools = [saveAnswersTool, finishedTool, queryUploadsTool];

    const agent = await createAgent({
      model: llm,
      tools,
      middleware: [createPromptCachingMiddleware(), createBrainstormMiddleware(initialState, middlewareTracker, config)],
    });

    const result = (await agent.invoke(stateForAgent as any, config)) as BrainstormGraphState;
    const lastMessage = lastAIMessage(result);
    if (!lastMessage) {
      throw new Error("Agent did not return an AI message");
    }

    const [message, updates] = await BrainstormBridge.toStructuredMessage(lastMessage);
    // Get updated next steps after agent processing
    const { memories, remainingTopics, currentTopic, placeholderText, availableCommands } =
      await new BrainstormNextStepsService(state).nextSteps();

    // Compute the final mode to persist in state
    const finalState: BrainstormGraphState = {
      ...state,
      currentTopic,
      skippedTopics: (result.skippedTopics || []) as Brainstorm.TopicName[],
      command: state.command, // command may have been consumed
    };
    const finalMode = getBrainstormMode(finalState);

    // Build final messages array from agent result
    // Include context messages that middleware injected (they're not in result.messages)
    const resultMessages = (result as any).messages || [];
    const originalMessageCount = (state.messages || []).length;
    const newMessages = resultMessages.slice(originalMessageCount);

    // Start with original messages
    let messages: BaseMessage[] = [...(state.messages || [])];

    // Add any context messages that were injected mid-turn
    // These need to be added BEFORE the new messages from the agent
    if (middlewareTracker.injectedContextMessages.length > 0) {
      messages = [...messages, ...middlewareTracker.injectedContextMessages];
    }

    // Add intermediate messages (tool calls, tool results, etc.)
    if (newMessages.length > 1) {
      const intermediateMessages = newMessages.slice(0, -1);
      messages = [...(messages as any[]), ...intermediateMessages];
    }

    if (message) {
      message.additional_kwargs = {
        ...message.additional_kwargs,
        currentTopic,
      };
      messages = [...(messages as any[]), message];
    }

    return {
      redirect: result.redirect as Brainstorm.RedirectType,
      skippedTopics: (result.skippedTopics || []) as Brainstorm.TopicName[],
      messages: messages as BaseMessage[],
      memories,
      currentTopic,
      remainingTopics,
      placeholderText,
      availableCommands,
      brainstormMode: finalMode, // Persist mode for next turn
    };
  }
);
