import { z } from "zod";
import { type BrainstormGraphState } from "@state";
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
import { BaseMessage, ToolMessage } from "@langchain/core/messages";
import { compactObject } from "@utils";

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

  tagMessages(tags: Brainstorm.TopicName[]): BaseMessage[] {
    return this.taggableMessages().map((message) => {
      if (this.messageNotTagged(message)) {
        message.additional_kwargs = {
          ...message.additional_kwargs,
          topics: tags,
        };
      }
      return message;
    })
  }

  private messageNotTagged = (message: BaseMessage): boolean => {
    return !('topics' in (message.additional_kwargs || {}))
  }
}

// 1. Take an array of messages
// 2. Determine which messages are not yet summarized
// 3. Summarize them
// 4. Return the updated, tagged messages + any new memories
export const summarizeMessages = async (messages: BaseMessage[]): Promise<Partial<BrainstormGraphState>> => {
  const messageTagger = new MessageTagger(messages);
  const messagesToSave = messageTagger.messagesToSave();

  const topics = Brainstorm.getAllTopics();

  // This should maybe be an error?
  if (messagesToSave.length === 0) {
    return {}
  }

  const prompt = `
    <background>
      The user and agent have been brainstorming about their business idea.
    </background>

    <available_topics>
      ${topics.map((topic) => `"${topic.name}: ${topic.description}"`).join(", ")}
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
  const outputSchema = z.object({
      output: z.array(z.object({
        topic: z.string(),
        summary: z.string(),
      })),
  });
  const structured = await getLLM().withStructuredOutput(outputSchema).invoke(prompt);

  type Output = z.infer<typeof outputSchema>;
  const output: Output["output"] = structured.output;
  const updates = output.reduce((acc: Record<Brainstorm.TopicName, string>, item: Output['output'][number]) => {
    acc[item.topic as Brainstorm.TopicName] = item.summary;
    return acc;
  }, {} as Record<Brainstorm.TopicName, string>);
  const allTopicsCovered = Object.keys(updates);
  const taggedMessages = messageTagger.tagMessages(allTopicsCovered as Brainstorm.TopicName[]);

  return {
    memories: updates,
    messages: taggedMessages,
  }
}

export const saveAnswers = async (
  memories: Record<Brainstorm.ConversationalTopicName, string | undefined | null>,
  websiteId: number,
  skippedTopics: string[],
): Promise<Partial<BrainstormGraphState>> => {
    const insert = withTimestamps(memories);
    const update = withUpdatedAt(memories);

    await db.insert(brainstormsTable).values({
      ...insert,
      websiteId,
    }).onConflictDoUpdate({
      target: [brainstormsTable.websiteId],
      set: {
        ...update,
      }
    }).returning();

    const updatedMemories = await (new BrainstormNextStepsService({ websiteId, skippedTopics: [] })).getMemories();
    const memoriesWithValues = compactObject(updatedMemories);
    let updatedSkippedTopics = skippedTopics?.filter((topic) => !memoriesWithValues[topic as Brainstorm.TopicName]) as Brainstorm.TopicName[];

    return {
      memories: updatedMemories,
      skippedTopics: updatedSkippedTopics,
    }
}

export const summarizeAndSaveAnswers = async (
  messages: BaseMessage[],
  websiteId: number,
  skippedTopics: string[],
): Promise<Partial<BrainstormGraphState>> => {
  let { memories, messages: taggedMessages } = await summarizeMessages(messages);
  if (!memories) {
    memories = {idea: "", audience: "", solution: "", socialProof: ""};
  }
  const completeMemories: Record<"idea" | "audience" | "solution" | "socialProof", string | null | undefined> = {
    idea: memories.idea ?? null,
    audience: memories.audience ?? null,
    solution: memories.solution ?? null,
    socialProof: memories.socialProof ?? null,
  };
  const { memories: updatedMemories, skippedTopics: updatedSkippedTopics } = await saveAnswers(completeMemories, websiteId, skippedTopics);

  return {
    memories: updatedMemories,
    messages: taggedMessages,
    skippedTopics: updatedSkippedTopics,
  }
}

const answersSchema = z.array(z.object({
  topic: z.enum(Brainstorm.BrainstormTopics),
  answer: z.string(),
}))
type Answers = z.infer<typeof answersSchema>;

export const saveAnswersTool = tool(
  async (args: { answers?: Answers }, config) => {
    const websiteId = getCurrentTaskInput<BrainstormGraphState>(config).websiteId;
    const skippedTopics = getCurrentTaskInput<BrainstormGraphState>(config).skippedTopics || [];

    if (!websiteId) {
        throw new Error("websiteId is required");
    }

    const toolMessage = new ToolMessage({
      content: "Saving answers...",
      tool_call_id: config?.toolCall.id,
      name: "saveAnswersTool",
    });

    // Model did not provide answers, so summarize the current thread
    if (!args.answers) {
      const currentMessages = getCurrentTaskInput<BrainstormGraphState>(config).messages;
      const stateUpdates = await summarizeAndSaveAnswers(currentMessages, websiteId, skippedTopics);

      return new Command({
        update: {
          ...stateUpdates,
          messages: [...(stateUpdates.messages || []), toolMessage],
        },
      });
    }

    const answersObject = args.answers.reduce((acc, answer) => {
      acc[answer.topic as Brainstorm.TopicName] = answer.answer;
      return acc;
    }, {} as Record<Brainstorm.TopicName, string>);

    const stateUpdates = await saveAnswers(answersObject, websiteId, skippedTopics);

    return new Command({
      update: {
        ...stateUpdates,
        messages: [...(stateUpdates.messages || []), toolMessage],
      },
    });
  },
  {
    name: "save_answers",
    description: `
        Save answers to the brainstorming session.
        Call this when the user has answered one or more of the remaining topics.

        If the user answered the question themselves: Do not provide any arguments.
        If you are answering SKIPPED questions for the user, provide answers in your
        own words
    `,
    schema: z.object({
      answers: answersSchema.optional(),
    }),
  }
);