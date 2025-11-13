import { NodeMiddleware } from "@middleware";
import type { BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { isHumanMessage, Brainstorm } from "@types";
import { db, brainstorms as brainstormsTable } from "@db";
import { withTimestamps, withUpdatedAt } from "@db";
import { BrainstormNextStepsService } from "@services";
import { chatHistoryPrompt } from "@prompts";
import { getLLM } from "@core";
import { BaseMessage } from "@langchain/core/messages";
export class MessageTagger {
  messages: BaseMessage[];
  tag: Brainstorm.TopicType;

  constructor(messages: BaseMessage[], tag: Brainstorm.TopicType) {
    this.messages = messages;
    this.tag = tag;
  }

  untaggedMessages() {
    return this.messagesToSave();
  }

  messagesToSave() {
    return this.messages.filter(this.messageNotTagged);
  }

  tagMessages(): BaseMessage[] {
    return this.messages.map((message) => {
      if (this.messageNotTagged(message)) {
        const MessageClass = message.constructor as typeof BaseMessage;
        // @ts-ignore - BaseMessage is abstract but runtime constructors are concrete
        return new MessageClass({
          ...message,
          additional_kwargs: {
            ...message.additional_kwargs,
            topic: this.tag,
          },
        });
      }
      return message;
    })
  }

  private messageNotTagged = (message: BaseMessage): boolean => {
    return !('topic' in (message.additional_kwargs || {}))
  }
}

export const saveAnswersNode = NodeMiddleware.use(async (
  state: BrainstormGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<BrainstormGraphState>> => {
  if (!state.currentTopic) {
    throw new Error("saveAnswersNode called without currentTopic");
  }

  if (!state.websiteId) {
    throw new Error("saveAnswersNode called without websiteId");
  }

  const messageTagger = new MessageTagger(state.messages, state.currentTopic);
  const messagesToSave = messageTagger.messagesToSave();
  const taggedMessages = messageTagger.tagMessages();
  console.log(taggedMessages.map((message) => message.additional_kwargs.topic));

  // This should maybe be an error?
  if (messagesToSave.length === 0) {
    return {}
  }

  try {
    const prompt = `
      <background>
        The user and agent have been brainstorming about their business idea.
      </background>

      <topic>
        ${state.currentTopic}
      </topic>

      <task>
        Read the recent chat history, and summarize their answer to: ${state.currentTopic},
        preserving as much information as possible. This will be used to generate 
        persuasive marketing copy, so be sure to capture all the details.
      </task>
      
      ${await chatHistoryPrompt({ messages: messagesToSave })}
    `;
    const summary = await getLLM().invoke(prompt);

    const updates: Partial<Brainstorm.MemoriesType> = {
      [state.currentTopic]: summary.content,
    };

    const insert = withTimestamps(updates);
    const update = withUpdatedAt(updates);

    await db.insert(brainstormsTable).values({
      ...insert,
      websiteId: state.websiteId,
    }).onConflictDoUpdate({
      target: [brainstormsTable.websiteId],
      set: {
        ...update,
      }
    }).returning();

    const memories = await (new BrainstormNextStepsService(state)).getMemories();

    return {
      memories,
      messages: taggedMessages,
    };
  } catch (error) {
    console.error('=== ERROR IN SAVE ANSWERS NODE ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
});
