import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { GuardrailService, type GuardrailOutput } from "@services";

class GuardrailNode extends BaseNode<BrainstormGraphState> {
  async execute(
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> {
    const service = new GuardrailService();

    const result: GuardrailOutput = await service.execute({
      messages: state.messages,
      questionIndex: state.questionIndex,
    }, config);

    return {
      isValidAnswer: result.isValidAnswer,
      route: result.route,
      messages: state.messages
    };
  }
}

export const guardrailNode = new GuardrailNode().toNodeFunction();
