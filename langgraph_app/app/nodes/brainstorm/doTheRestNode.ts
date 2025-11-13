import { AIMessage } from "@langchain/core/messages";
import { NodeMiddleware } from "@middleware";
import { getLLM } from "@core";
import { type BrainstormGraphState } from "@state";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { Brainstorm } from "@types";
import { chatHistoryPrompt, toJSON } from "@prompts";
import { db, brainstorms as brainstormsTable, withTimestamps, withUpdatedAt } from "@db";

export const doTheRestNode = NodeMiddleware.use(async (
  state: BrainstormGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<BrainstormGraphState>> => {
  const remainingTopics = state.remainingTopics?.filter(t => t !== state.currentTopic) || [];
  
  if (remainingTopics.length === 0) {
    const llm = getLLM().withStructuredOutput(Brainstorm.questionSchema).withConfig({ tags: ['notify'] });
    
    const response = await llm.invoke(`
      All topics are already answered! Guide the user to next steps:
      - Brand Personalization (optional)
      - "Build My Site" button
    `);

    const aiMessage = new AIMessage({
      content: JSON.stringify(response, null, 2),
      response_metadata: response,
    });

    return {
      messages: [...state.messages, aiMessage],
      currentTopic: "lookAndFeel" as Brainstorm.TopicType,
    };
  }

  const chatHistory = await chatHistoryPrompt({ messages: state.messages });
  const existingMemories = state.memories || {};

  const prompt = `
    <role>You are a marketing expert filling in remaining brainstorming details.</role>
    
    <what_we_know>
      ${toJSON(existingMemories)}
    </what_we_know>
    
    <conversation_context>
      ${chatHistory}
    </conversation_context>
    
    <task>
      Based on what the user has told us, generate plausible, high-quality answers for these topics:
      ${remainingTopics.map(t => `- ${t}: ${Brainstorm.TopicDescriptions[t]}`).join('\n')}
      
      For each topic, provide 2-3 sentences that:
      - Align with what we know about their business
      - Are specific and marketing-worthy
      - Use professional but conversational tone
      
      Return JSON with keys: ${remainingTopics.join(', ')}
    </task>
  `;

  const llm = getLLM();
  const response = await llm.invoke(prompt);
  
  let generatedAnswers: Partial<Brainstorm.MemoriesType>;
  try {
    generatedAnswers = JSON.parse(response.content as string);
  } catch {
    generatedAnswers = remainingTopics.reduce((acc, topic) => ({
      ...acc,
      [topic]: response.content
    }), {} as Partial<Brainstorm.MemoriesType>);
  }

  const updates = generatedAnswers;
  const insert = withTimestamps(updates);
  const update = withUpdatedAt(updates);

  await db.insert(brainstormsTable).values({
    ...insert,
    websiteId: state.websiteId,
  }).onConflictDoUpdate({
    target: [brainstormsTable.websiteId],
    set: update
  });

  // Generate confirmation message
  const confirmLlm = getLLM().withStructuredOutput(Brainstorm.questionSchema).withConfig({ tags: ['notify'] });
  const confirmation = await confirmLlm.invoke(`
    I've filled in plausible answers for: ${remainingTopics.join(', ')}.
    
    Tell the user they can review/adjust these later if needed, and guide them to:
    - Brand Personalization (optional)
    - "Build My Site" button
    
    Be encouraging and celebrate their progress.
  `) as Brainstorm.QuestionType;

  const aiMessage = new AIMessage({
    content: JSON.stringify(confirmation, null, 2),
    response_metadata: confirmation,
  });

  return {
    messages: [...state.messages, aiMessage],
    memories: { ...existingMemories, ...generatedAnswers },
    currentTopic: "lookAndFeel" as Brainstorm.TopicType,
    remainingTopics: [],
  };
});
