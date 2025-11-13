import { AIMessage } from "@langchain/core/messages";
import { NodeMiddleware } from "@middleware";
import { getLLM } from "@core";
import { type BrainstormGraphState } from "@state";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { Brainstorm } from "@types";
import { BrainstormNextStepsService } from "@services";
import { askQuestionPrompt } from "@prompts";

export const skipNode = NodeMiddleware.use(async (
  state: BrainstormGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<BrainstormGraphState>> => {
  if (!state.currentTopic) {
    throw new Error("skipNode called without currentTopic");
  }

  // Mark current topic as skipped (we'll handle by just not saving it)
  const skippedTopic = state.currentTopic;
  
  // Get next topic
  const remainingAfterSkip = state.remainingTopics?.filter(t => t !== skippedTopic) || [];
  const nextTopic = remainingAfterSkip[0];

  if (!nextTopic) {
    // No more topics - move to next steps
    const llm = getLLM().withStructuredOutput(Brainstorm.questionSchema).withConfig({ tags: ['notify'] });
    
    const response = await llm.invoke(`
      The user skipped the last question. All brainstorming topics are now complete.
      
      Guide them to next steps:
      - Brand Personalization (optional)
      - "Build My Site" button
      
      Be encouraging and celebrate their progress.
    `);

    const aiMessage = new AIMessage({
      content: JSON.stringify(response, null, 2),
      response_metadata: response,
    });

    return {
      messages: [...state.messages, aiMessage],
      currentTopic: "lookAndFeel" as Brainstorm.TopicType,
      remainingTopics: [],
    };
  }

  // Ask next question
  const nextStepState = {
    ...state,
    currentTopic: nextTopic
  };

  const prompt = await askQuestionPrompt(nextStepState);
  const llm = getLLM().withStructuredOutput(Brainstorm.questionSchema).withConfig({ tags: ['notify'] });
  
  const response = await llm.invoke(prompt) as Brainstorm.QuestionType;

  const aiMessage = new AIMessage({
    content: JSON.stringify(response, null, 2),
    response_metadata: response,
  });

  const updatedState = await new BrainstormNextStepsService(nextStepState).nextSteps();

  return {
    messages: [...state.messages, aiMessage],
    ...updatedState,
  };
});
