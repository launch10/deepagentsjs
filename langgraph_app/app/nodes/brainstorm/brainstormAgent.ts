import { AIMessage } from "@langchain/core/messages";
import { NodeMiddleware } from "@middleware";
import { getLLM } from "@core";
import type { BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { questionAskerPrompt, clarificationPrompt } from "@prompts";
import { Brainstorm } from "@types";
import { BrainstormNextStepsService } from "@services";

export const brainstormAgent = NodeMiddleware.use(async (
  state: BrainstormGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<BrainstormGraphState>> => {
  console.log(`brainstormAgent called for ${state.currentTopic}`)
  if (!state.currentTopic) {
    throw new Error("brainstormAgent called without currentTopic");
  }

  const llm = getLLM()
    .withStructuredOutput(Brainstorm.questionSchema)
    .withConfig({ tags: ['notify'] });
  
  const isAskingQuestion = !state.qa || state.qa.success;
  const prompt = isAskingQuestion 
    ? await questionAskerPrompt(state)
    : await clarificationPrompt(state);

  const response = await llm.invoke(prompt);

  const aiMessage = new AIMessage({
    content: JSON.stringify(response, null, 2),
    response_metadata: response,
  });


  const { memories, remainingTopics, currentTopic, placeholderText, availableActions } = await new BrainstormNextStepsService(state).nextSteps();

  return {
      messages: [...(state.messages || []), aiMessage],
      memories,
      currentTopic,
      placeholderText,
      remainingTopics,
      availableActions,
  };
});
