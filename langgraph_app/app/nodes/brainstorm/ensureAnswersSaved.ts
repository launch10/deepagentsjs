import { NodeMiddleware } from "@middleware";
import { type BrainstormGraphState } from "@state";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { summarizeAndSaveAnswers } from "@tools";
import { Brainstorm } from "@types";
import { ToolMessage } from "@langchain/core/messages";
import { getLogger } from "@core";

const log = getLogger({ component: "ensureAnswersSaved" });

/**
 * Safety net node that ensures answers are extracted and saved after
 * every brainstorm agent turn.
 *
 * The model frequently forgets to call save_answers, and saved answers
 * determine which question we ask next. This node awaits the save to
 * prevent the next turn from reading stale data.
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
      log.warn("No websiteId, cannot save answers");
      return {};
    }

    if (!state.threadId || !state.jwt) {
      log.warn("No threadId or jwt, cannot save answers");
      return {};
    }

    // Await the save to prevent the next turn from reading stale DB data.
    // BrainstormNextStepsService reads from DB to determine the next question,
    // so answers must be persisted before the graph returns.
    log.info({ topics: topicsNeedingAnswers }, "Saving answers for topics");

    try {
      await summarizeAndSaveAnswers(
        state.messages || [],
        state.websiteId,
        skippedTopics,
        state.threadId,
        state.jwt
      );
    } catch (err) {
      log.error({ err }, "Save failed");
    }

    return {};
  }
);
