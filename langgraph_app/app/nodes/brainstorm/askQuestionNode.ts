import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { AskQuestionService, type AskQuestionOutput } from "@services";
import { AIMessage } from "@langchain/core/messages";

/**
 * Node that asks a question to the user during brainstorming mode
 */
class AskQuestionNode extends BaseNode<BrainstormGraphState> {
  async execute(
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> {
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
}

// Export as a function for use in the graph
export const askQuestionNode = new AskQuestionNode().toNodeFunction();
