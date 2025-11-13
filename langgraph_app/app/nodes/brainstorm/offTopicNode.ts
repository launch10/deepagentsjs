import { AIMessage } from "@langchain/core/messages";
import { NodeMiddleware } from "@middleware";
import { getLLM } from "@core";
import { type BrainstormGraphState } from "@state";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { Brainstorm } from "@types";
import { askQuestionPrompt } from "@prompts";

export const offTopicNode = NodeMiddleware.use(async (
  state: BrainstormGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<BrainstormGraphState>> => {
  if (!state.currentTopic) {
    throw new Error("offTopicNode called without currentTopic");
  }

  // Gently redirect back to current question
  const prompt = await askQuestionPrompt(state);
  const llm = getLLM().withStructuredOutput(Brainstorm.questionSchema).withConfig({ tags: ['notify'] });
  
  const response = await llm.invoke(`
    The user went off-topic or was unclear. 
    
    Gently bring them back to the current question about: ${state.currentTopic}
    
    Be warm and encouraging. Maybe add a light emoji.
    
    Then ask the question from this context:
    ${prompt}
  `) as Brainstorm.QuestionType;

  const aiMessage = new AIMessage({
    content: JSON.stringify(response, null, 2),
    response_metadata: response,
  });

  return {
    messages: [...state.messages, aiMessage],
  };
});
