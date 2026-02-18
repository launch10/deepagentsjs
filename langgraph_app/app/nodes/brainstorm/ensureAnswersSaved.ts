import { NodeMiddleware } from "@middleware";
import { type BrainstormGraphState } from "@state";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { summarizeAndSaveAnswers } from "@tools";
import { Brainstorm } from "@types";
import { ToolMessage } from "@langchain/core/messages";

/**
 * Safety net node that ensures answers are extracted and saved after
 * every brainstorm agent turn.
 *
 * The model frequently forgets to call save_answers, and saved answers
 * determine which question we ask next. This node fires-and-forgets
 * the save so it doesn't block the UI from becoming ready.
 *
 * Skip conditions:
 * - save_answers was already called this turn (check for ToolMessage)
 * - No conversational topics need answers
 * - No websiteId available
 */
export const ensureAnswersSaved = NodeMiddleware.use(
  {},
  async (
    state: BrainstormGraphState,
    _config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> => {
    // Skip if save_answers was already called this turn
    const saveAnswersToolMessage = (state.messages || []).find(
      (msg) => ToolMessage.isInstance(msg) && msg.name === "save_answers"
    );
    if (saveAnswersToolMessage) {
      return {};
    }

    // Check if there are conversational topics that need answers
    const remainingConversationalTopics = (state.remainingTopics || []).filter((t) =>
      Brainstorm.ConversationalTopics.includes(t as Brainstorm.ConversationalTopicName)
    );
    const skippedTopics = state.skippedTopics || [];
    const topicsNeedingAnswers = [...remainingConversationalTopics, ...skippedTopics];

    if (topicsNeedingAnswers.length === 0) {
      return {};
    }

    if (!state.websiteId) {
      console.warn("[ensureAnswersSaved] No websiteId, cannot save answers");
      return {};
    }

    if (!state.threadId || !state.jwt) {
      console.warn("[ensureAnswersSaved] No threadId or jwt, cannot save answers");
      return {};
    }

    // Fire-and-forget: trigger save but don't await.
    // The next turn reads from DB via BrainstormNextStepsService, so state
    // will be correct even if this completes after the graph returns.
    console.log(
      `[ensureAnswersSaved] Background save for topics: ${topicsNeedingAnswers.join(", ")}`
    );

    summarizeAndSaveAnswers(
      state.messages || [], state.websiteId, skippedTopics, state.threadId, state.jwt
    ).catch((err) =>
      console.error("[ensureAnswersSaved] Background save failed:", err)
    );

    return {};
  }
);
