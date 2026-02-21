import { createAgent, createMiddleware } from "langchain";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { StateSchema, ReducedValue } from "@langchain/langgraph";
import { type BaseMessage } from "@langchain/core/messages";
import { getLLM, createPromptCachingMiddleware } from "@core";
import { chooseBrainstormPrompt, getBrainstormContextMessage, getBrainstormMode } from "@prompts";
import { NodeMiddleware } from "@middleware";
import {
  saveAnswersTool,
  navigateTool,
  queryUploadsTool,
  setLogoTool,
  saveSocialLinksTool,
  uploadProjectImagesTool,
} from "@tools";
import { changeColorSchemeTool } from "@tools";
import { Brainstorm, type AgentIntent, agentIntentSchema } from "@types";
import { type BrainstormGraphState, type BrainstormModeType } from "@state";
import z from "zod";
import { BrainstormNextStepsService } from "@services";
import { lastAIMessage } from "@types";
import { toStructuredMessage } from "langgraph-ai-sdk";
import { Conversation } from "@conversation";
import { summarizeMessages } from "@nodes";

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
 * - Initial mode switch detected before agent, context passed via Conversation.start()
 *   for proper CTX-before-HUMAN ordering (same pattern as coding/ads agents)
 * - Middleware catches MID-TURN switches (after tool calls like saveAnswers)
 * - System prompt is regenerated per model call based on current state
 * - Compaction is handled by Conversation.start() (no separate graph node)
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
    // doTheRest, skip). Build context message and pass as extraContext to
    // Conversation.start() for proper CTX-before-HUMAN ordering.
    const previousMode = (state.brainstormMode ?? "default") as BrainstormModeType;
    const currentMode = getBrainstormMode(initialState);

    let initialContextMessages: BaseMessage[] = [];
    if (previousMode !== currentMode) {
      const ctx = await getBrainstormContextMessage(
        initialState,
        currentMode,
        previousMode,
        config
      );
      if (ctx) initialContextMessages.push(ctx as unknown as BaseMessage);
    }

    // Create tracker — starts at currentMode since initial switch is
    // already handled by Conversation.start(). Middleware only catches mid-turn
    // switches (e.g., after saveAnswers changes brainstorm state).
    const middlewareTracker: MiddlewareTracker = {
      injectedContextMessages: [],
      lastSeenMode: currentMode,
    };

    // Build agent before Conversation.start() so it's ready for the callback
    const llm = (await getLLM({ maxTier: 2 })).withConfig({ tags: ["notify"] });
    const tools = [
      saveAnswersTool,
      navigateTool,
      queryUploadsTool,
      setLogoTool,
      saveSocialLinksTool,
      uploadProjectImagesTool,
      changeColorSchemeTool,
    ];

    const agent = await createAgent({
      model: llm,
      tools,
      stateSchema: new StateSchema({
        agentIntents: new ReducedValue(z.any().optional() as any, {
          reducer: (current: AgentIntent[] | undefined, next: AgentIntent[] | undefined) => {
            if (!next) return current;
            if (!current) return next;
            return [...current, ...next];
          },
        }),
      }),
      middleware: [
        createPromptCachingMiddleware(),
        createBrainstormMiddleware(initialState, middlewareTracker, currentMode, config),
      ],
    });

    // Run through Conversation.start() — handles prepare, window, compact
    const convResult = await Conversation.start(
      {
        messages: state.messages || [],
        extraContext: initialContextMessages,
        maxTurnPairs: 10,
        maxChars: 40_000,
        compact: { summarizer: summarizeMessages },
      },
      async (prepared) => {
        const stateForAgent: BrainstormGraphState = {
          ...initialState,
          messages: prepared,
        };

        const agentResult = (await agent.invoke(
          stateForAgent as any,
          config
        )) as BrainstormGraphState;
        const lastMessage = lastAIMessage(agentResult);
        if (!lastMessage) {
          throw new Error("Agent did not return an AI message");
        }

        const [structured] = await toStructuredMessage(lastMessage);

        // Get updated next steps after agent processing
        const nextSteps = await new BrainstormNextStepsService(state).nextSteps();

        // Compute the final mode to persist in state
        const finalState: BrainstormGraphState = {
          ...state,
          currentTopic: nextSteps.currentTopic,
          skippedTopics: (agentResult.skippedTopics || []) as Brainstorm.TopicName[],
        };
        const finalMode = getBrainstormMode(finalState);

        // Slice off input to get only new messages from the agent
        const resultMessages = (agentResult as any).messages || [];
        const agentNewMessages = resultMessages.slice(prepared.length);

        // Replace the last AI message with its structured version for UI rendering.
        // Use type check (not position) — with returnDirect tools the last message
        // may be a ToolMessage, not an AIMessage.
        if (structured) {
          structured.additional_kwargs = {
            ...structured.additional_kwargs,
            currentTopic: nextSteps.currentTopic,
          };
          for (let i = agentNewMessages.length - 1; i >= 0; i--) {
            if (agentNewMessages[i]?._getType?.() === "ai") {
              agentNewMessages[i] = structured;
              break;
            }
          }
        }

        return {
          messages: agentNewMessages,
          redirect: agentResult.redirect as Brainstorm.RedirectType,
          agentIntents: agentResult.agentIntents,
          skippedTopics: (agentResult.skippedTopics || []) as Brainstorm.TopicName[],
          memories: nextSteps.memories,
          remainingTopics: nextSteps.remainingTopics,
          currentTopic: nextSteps.currentTopic,
          placeholderText: nextSteps.placeholderText,
          availableIntents: nextSteps.availableIntents,
          brainstormMode: finalMode,
        };
      }
    );

    // Add middleware-tracked mid-turn context (mode switches after saveAnswers).
    // These are brainstorm-specific and can't be absorbed by Conversation.start().
    const finalMessages = [
      ...convResult.messages,
      ...middlewareTracker.injectedContextMessages,
    ] as BaseMessage[];

    return {
      redirect: convResult.redirect as Brainstorm.RedirectType,
      agentIntents: convResult.agentIntents,
      skippedTopics: convResult.skippedTopics as Brainstorm.TopicName[],
      messages: finalMessages,
      memories: convResult.memories,
      currentTopic: convResult.currentTopic,
      remainingTopics: convResult.remainingTopics,
      placeholderText: convResult.placeholderText,
      availableIntents: convResult.availableIntents,
      brainstormMode: convResult.brainstormMode,
    };
  }
);
