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
import { toStructuredMessage } from "langgraph-ai-sdk";
import { Conversation } from "@conversation";

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
  availableIntents: z.array(z.string()).default([]),
  intent: z.any().optional(),
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
  initialMode: BrainstormModeType,
  config?: LangGraphRunnableConfig
) => {
  // Start tracking from the current mode — the initial mode switch
  // is already handled by prepareTurn() before the agent runs.
  // The middleware only needs to catch MID-TURN switches (after tool calls).
  tracker.lastSeenMode = initialMode;
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
 * - Initial mode switch detected before agent, context passed to prepareTurn()
 *   for proper CTX-before-HUMAN ordering (same pattern as coding/ads agents)
 * - Middleware catches MID-TURN switches (after tool calls like saveAnswers)
 * - System prompt is regenerated per model call based on current state
 * - compactConversation runs after this node (graph-level)
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

    // Validate intent against available intents for current topic.
    // This prevents forced intents that don't match the topic's available actions
    // (e.g., do_the_rest on the idea topic where only help_me is allowed).
    const validatedIntent =
      state.intent?.type &&
      initialNextSteps.availableIntents?.includes(
        state.intent.type as Brainstorm.BrainstormIntentName
      )
        ? state.intent
        : undefined;

    const initialState: BrainstormGraphState = {
      ...state,
      ...initialNextSteps,
      intent: validatedIntent,
    };

    // Detect initial mode switch (out-of-band UI interactions like helpMe,
    // doTheRest, skip). Build context message and pass through prepareTurn()
    // so it's positioned correctly (CTX before HUMAN for user-message turns,
    // appended for intent-driven turns). Same pattern as coding/ads agents.
    const previousMode = (state.brainstormMode ?? "default") as BrainstormModeType;
    const currentMode = getBrainstormMode(initialState);

    let initialContextMessages: BaseMessage[] = [];
    if (previousMode !== currentMode) {
      const ctx = await getBrainstormContextMessage(
        initialState, currentMode, previousMode, config
      );
      if (ctx) initialContextMessages.push(ctx as unknown as BaseMessage);
    }

    const windowedMessages = new Conversation(state.messages || []).prepareTurn({
      contextMessages: initialContextMessages,
      maxTurnPairs: 10,
      maxChars: 40_000,
    });

    // Prepare initial state for agent
    const stateForAgent: BrainstormGraphState = {
      ...initialState,
      messages: windowedMessages,
    };

    // Create tracker — starts at currentMode since initial switch is
    // already handled by prepareTurn(). Middleware only catches mid-turn
    // switches (e.g., after saveAnswers changes brainstorm state).
    const middlewareTracker: MiddlewareTracker = {
      injectedContextMessages: [],
      lastSeenMode: currentMode,
    };

    const llm = (await getLLM({ maxTier: 2 })).withConfig({ tags: ["notify"] });
    const tools = [saveAnswersTool, finishedTool, queryUploadsTool];

    const agent = await createAgent({
      model: llm,
      tools,
      middleware: [
        createPromptCachingMiddleware(),
        createBrainstormMiddleware(initialState, middlewareTracker, currentMode, config),
      ],
    });

    const result = (await agent.invoke(stateForAgent as any, config)) as BrainstormGraphState;
    const lastMessage = lastAIMessage(result);
    if (!lastMessage) {
      throw new Error("Agent did not return an AI message");
    }

    const [message] = await toStructuredMessage(lastMessage);
    // Get updated next steps after agent processing
    const { memories, remainingTopics, currentTopic, placeholderText, availableIntents } =
      await new BrainstormNextStepsService(state).nextSteps();

    // Compute the final mode to persist in state
    const finalState: BrainstormGraphState = {
      ...state,
      currentTopic,
      skippedTopics: (result.skippedTopics || []) as Brainstorm.TopicName[],
    };
    const finalMode = getBrainstormMode(finalState);

    // Build final messages array from agent result.
    // Context messages need to be persisted in state so future turns see them.
    const resultMessages = (result as any).messages || [];
    const originalMessageCount = windowedMessages.length;
    const newMessages = resultMessages.slice(originalMessageCount);

    // Start with original messages
    let messages: BaseMessage[] = [...(state.messages || [])];

    // Add initial context (out-of-band mode switch detected before agent ran)
    if (initialContextMessages.length > 0) {
      messages = [...messages, ...initialContextMessages];
    }

    // Add mid-turn context (injected by middleware during tool calls, e.g. after saveAnswers)
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
      availableIntents,
      brainstormMode: finalMode, // Persist mode for next turn
    };
  }
);
