import { NodeMiddleware } from "@core";
import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { AskQuestionService, type AskQuestionOutput } from "@services";

/**
 * Node that asks a question to the user during brainstorming mode
 */
export const askQuestionNode = NodeMiddleware.use(
  async (
    state: BrainstormGraphState, 
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> => {
    const service = new AskQuestionService();

    const result: AskQuestionOutput = await service.execute({
      messages: state.messages,
      questionIndex: state.questionIndex,
      isValidAnswer: state.isValidAnswer,
    }, config)

    return {
      nextQuestion: result.question,
      questionIndex: result.questionIndex,
      messages: result.messages
    };
  }
);
