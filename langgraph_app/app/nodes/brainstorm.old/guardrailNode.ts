import { NodeMiddleware } from "@core";
import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GuardrailService, type GuardrailOutput } from "@services";

export const guardrailNode = NodeMiddleware.use(
  async (
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> => {
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
);
