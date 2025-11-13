import { AIMessage } from "@langchain/core/messages";
import { NodeMiddleware } from "@middleware";
import { getLLM } from "@core";
import { renderPrompt, toJSON } from "@prompts";
import type { BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Brainstorm } from "@types";
import { nextStepsPrompt } from "@prompts";

export const nextStepsAgent = NodeMiddleware.use(async (
  state: BrainstormGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<BrainstormGraphState>> => {
  const prompt = nextStepsPrompt(state);
  const llm = getLLM()
    .withStructuredOutput(Brainstorm.questionSchema)
    .withConfig({ tags: ['notify'] });

  const response = await llm.invoke(prompt);

  const aiMessage = new AIMessage({
    content: JSON.stringify(response, null, 2),
    response_metadata: response,
  });

  return {
    messages: [...state.messages, aiMessage],
  };
});
