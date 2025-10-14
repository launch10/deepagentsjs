import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { AskQuestionService } from "@services";

/**
 * Node that asks a question to the user during brainstorming mode
 */
class AskQuestionNode extends BaseNode<BrainstormGraphState> {
  async execute(
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> {
    const service = new AskQuestionService();

    return service.execute({
      projectName: state.projectName,
      jwt: state.jwt,
      accountId: state.accountId,
    }, config)
  }
}

// Export as a function for use in the graph
export const askQuestionNode = new AskQuestionNode().toNodeFunction();
