import { NodeMiddleware } from "@middleware";
import { getLLM } from "@core";
import type { BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Brainstorm } from "@types";
import { qaAgentPrompt } from "@prompts";

export const qaAgent = NodeMiddleware.use(async (
  state: BrainstormGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<BrainstormGraphState>> => {
  if (!state.currentTopic) {
    throw new Error("qaAgent called without currentTopic");
  }

  const prompt = await qaAgentPrompt(state);
  const llm = getLLM()
    .withStructuredOutput(Brainstorm.qaSchema);
  
  const evaluation = await llm.invoke(prompt) as Brainstorm.QAResultType;

  return {
    qa: evaluation,
  };
});
