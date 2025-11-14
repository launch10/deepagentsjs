import { z } from "zod";
import { type BrainstormGraphState } from "@state";
import { ToolMessage } from "@langchain/core/messages";
import {
  getCurrentTaskInput,
  Command,
} from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { Brainstorm } from "@types";
import { db, brainstorms as brainstormsTable } from "@db";
import { withTimestamps, withUpdatedAt } from "@db";
import { BrainstormNextStepsService } from "@services";
import { chatHistoryPrompt } from "@prompts";
import { getLLM } from "@core";
import { BaseMessage } from "@langchain/core/messages";

// Could work on tagging these in a separate model in order to not
// have so much message history returned from the tool
export class MessageTagger {
  messages: BaseMessage[];

  constructor(messages: BaseMessage[]) {
    this.messages = messages;
  }

  taggableMessages() {
    return this.messages.filter((m) => typeof m.content === 'string')
  }

  untaggedMessages() {
    return this.messagesToSave();
  }

  messagesToSave() {
    return this.taggableMessages().filter(this.messageNotTagged);
  }

  tagMessages(tags: Brainstorm.TopicType[]): BaseMessage[] {
    return this.taggableMessages().map((message) => {
      if (this.messageNotTagged(message)) {
        return {
          ...message,
          additional_kwargs: {
            ...message.additional_kwargs,
            topics: tags,
          },
        };
      }
      return message;
    })
  }

  private messageNotTagged = (message: BaseMessage): boolean => {
    return !('topics' in (message.additional_kwargs || {}))
  }
}

export const saveAnswers = async (
  messages: BaseMessage[],
  websiteId: number,
): Promise<Partial<BrainstormGraphState>> => {
  const messageTagger = new MessageTagger(messages);
  const messagesToSave = messageTagger.messagesToSave();

  // This should maybe be an error?
  if (messagesToSave.length === 0) {
    return {}
  }

  try {
    const prompt = `
      <background>
        The user and agent have been brainstorming about their business idea.
      </background>

      <available_topics>
        ${Brainstorm.BrainstormTopics.map((topic) => `"${topic}: ${Brainstorm.TopicDescriptions[topic]}"`).join(", ")}
      </available_topics>

      <task>
        Read the recent chat history, and summarize their answers,
        preserving as much information as possible. This will be used to generate 
        persuasive marketing copy, so be sure to capture all the details.

        If the user has answered MULTIPLE topics well, return an array of objects with the following shape:
        {
            topic: string,
            summary: string,
        }
      </task>
      
      ${await chatHistoryPrompt({ messages: messagesToSave })}

      <output>
        Return an array of objects with the following shape:
        {
            topic: string,
            summary: string,
        }
      </output>
    `;
    const structured = await getLLM().withStructuredOutput(
    z.object({
        output: z.array(z.object({
        topic: z.string(),
        summary: z.string(),
        })),
    })
    ).invoke(prompt);

    const output = structured.output;
    const updates = output.reduce((acc, item) => {
      acc[item.topic] = item.summary;
      return acc;
    }, {} as Record<string, string>);
    const allTopicsCovered = Object.keys(updates);
    const taggedMessages = messageTagger.tagMessages(allTopicsCovered);

    const insert = withTimestamps(updates);
    const update = withUpdatedAt(updates);

    await db.insert(brainstormsTable).values({
      ...insert,
      websiteId,
    }).onConflictDoUpdate({
      target: [brainstormsTable.websiteId],
      set: {
        ...update,
      }
    }).returning();

    const memories = await (new BrainstormNextStepsService({ websiteId })).getMemories();

    return {
      memories,
      messages: taggedMessages,
    }
  } catch (error) {
    console.error('=== ERROR IN SAVE ANSWERS NODE ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
};

export const saveAnswersTool = tool(
  async (_, config) => {
    // Customize context received by sub-agent
    // Access full thread messages from the config
    const currentMessages = getCurrentTaskInput<BrainstormGraphState>(config).messages;
    const websiteId = getCurrentTaskInput<BrainstormGraphState>(config).websiteId;

    if (!websiteId) {
        throw new Error("websiteId is required");
    }

    const { memories, messages } = await saveAnswers(currentMessages, websiteId);

    // Since we want to tag
    // return new Command({
    //   update: {
    //     "memories": memories,
    //     "messages": [
    //       new ToolMessage({
    //         content: `Successfully saved answers.`,
    //         tool_call_id: config.toolCall.id,
    //       })
    //     ],
    //   },
    return {
      messages
    }
  },
  {
    name: "save_answers",
    description: `
        Save answers to the brainstorming session. 
        Call this when the user has answered one or more of the remaining topics.
        IMPORTANT: You do not need to call this with any arguments,
        it will automatically save the answers from the current thread.
    `,
    schema: z.object({
        save: z.literal(true)
    }),
  }
);