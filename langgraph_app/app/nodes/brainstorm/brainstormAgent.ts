import { AIMessage } from "@langchain/core/messages";
import { NodeMiddleware } from "@middleware";
import { getLLM } from "@core";
import type { BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { askQuestionPrompt, clarificationPrompt } from "@prompts";
import { Brainstorm } from "@types";
import { BrainstormNextStepsService } from "@services";

export const brainstormAgent = NodeMiddleware.use(async (
  originalState: BrainstormGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<BrainstormGraphState>> => {
  const nextSteps = await new BrainstormNextStepsService(originalState).nextSteps();
  let state = {
    ...originalState,
    ...nextSteps,
  }

  if (!state.currentTopic) {
    throw new Error("brainstormAgent called without currentTopic");
  }

  const llm = getLLM()
    .withStructuredOutput(Brainstorm.questionSchema)
    .withConfig({ tags: ['notify'] });
  
  const isAskingQuestion = !state.qa || state.qa.success;
  const prompt = isAskingQuestion 
    ? await askQuestionPrompt(state)
    : await clarificationPrompt(state);
  
  console.log(`${isAskingQuestion ? 'Asking question' : 'Clarifying'} for ${state.currentTopic}`)

  const response = await llm.invoke(prompt);
  console.log(response)

  const aiMessage = new AIMessage({
    content: JSON.stringify(response, null, 2),
    response_metadata: response,
  });

  return {
      messages: [...(state.messages || []), aiMessage],
      memories: state.memories,
      currentTopic: state.currentTopic,
      placeholderText: state.placeholderText,
      remainingTopics: state.remainingTopics,
      availableActions: state.availableActions,
  };
});
