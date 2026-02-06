import { z } from "zod";
import { type BrainstormGraphState } from "@state";
import { getCurrentTaskInput, Command } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { Brainstorm } from "@types";
import { BrainstormNextStepsService } from "@services";
import { chatHistoryPrompt } from "@prompts";
import { getLLM } from "@core";
import { BaseMessage, ToolMessage } from "@langchain/core/messages";
import { compactObject } from "@utils";
import { BrainstormAPIService } from "@rails_api";

// Could work on tagging these in a separate model in order to not
// have so much message history returned from the tool
export class MessageTagger {
  messages: BaseMessage[];

  constructor(messages: BaseMessage[]) {
    this.messages = messages;
  }

  taggableMessages() {
    return this.messages.filter((m) => typeof m.content === "string");
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
    });
  }

  private messageNotTagged = (message: BaseMessage): boolean => {
    return !("topics" in (message.additional_kwargs || {}));
  };
}

// 1. Take an array of messages
// 2. Determine which messages are not yet summarized
// 3. Summarize them
// 4. Return the updated, tagged messages + any new memories
export const summarizeMessages = async (
  messages: BaseMessage[]
): Promise<Partial<BrainstormGraphState>> => {
  const messageTagger = new MessageTagger(messages);
  const messagesToSave = messageTagger.messagesToSave();
  const topics = Brainstorm.getAllTopics().filter((t) =>
    Brainstorm.ConversationalTopics.includes(t.name as Brainstorm.ConversationalTopicName)
  );

  // This should maybe be an error?
  if (messagesToSave.length === 0) {
    return {};
  }

  const prompt = `
    <background>
      The user and agent have been brainstorming about their business idea.
    </background>

    <available_topics>
      ${topics.map((topic) => `"${topic.name}: ${topic.description}"`).join(", ")}
    </available_topics>

    <task>
      Read the recent chat history, and summarize ONLY the topics that the user
      has EXPLICITLY and DIRECTLY answered in their messages. Preserve as much
      information as possible - this will be used to generate persuasive marketing copy.

      CRITICAL RULES:
      1. Only extract a topic if the user has DIRECTLY provided information about it
      2. Do NOT infer or extrapolate topics from vague or tangential mentions
      3. Do NOT extract a topic just because it was mentioned in an AI question
      4. The user must have given a substantive answer about the topic
      5. If uncertain whether the user answered a topic, do NOT include it
      6. But be generous with a user's response - if they have made a valid attempt to answer, save it.

      For each topic the user answered well, return an object with:
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

      Only include topics where the user gave a clear, substantive answer.
      When in doubt, leave it out - it's better to ask again than to hallucinate an answer.
    </output>
  `;
  const outputSchema = z.object({
    output: z.array(
      z.object({
        topic: z.string(),
        summary: z.string(),
      })
    ),
  });
  const structured = await (await getLLM({})).withStructuredOutput(outputSchema).invoke(prompt);

  type Output = z.infer<typeof outputSchema>;
  const output: Output["output"] = structured.output;
  const updates = output.reduce(
    (acc: Record<Brainstorm.TopicName, string>, item: Output["output"][number]) => {
      acc[item.topic as Brainstorm.TopicName] = item.summary;
      return acc;
    },
    {} as Record<Brainstorm.TopicName, string>
  );
  const allTopicsCovered = Object.keys(updates);
  const taggedMessages = messageTagger.tagMessages(allTopicsCovered as Brainstorm.TopicName[]);

  return {
    memories: updates,
    messages: taggedMessages,
  };
};

export const saveAnswers = async (
  memories: Partial<Record<Brainstorm.ConversationalTopicName, string | undefined | null>>,
  websiteId: number,
  skippedTopics: string[],
  threadId: string,
  jwt: string
): Promise<Partial<BrainstormGraphState>> => {
  // Use Rails API to update brainstorm - this triggers the TracksAgentContext callback
  // which creates brainstorm.finished events when all fields are complete
  const api = new BrainstormAPIService({ jwt });
  await api.update(threadId, {
    idea: memories.idea ?? undefined,
    audience: memories.audience ?? undefined,
    solution: memories.solution ?? undefined,
    social_proof: memories.socialProof ?? undefined,
  });

  const updatedMemories = await new BrainstormNextStepsService({
    websiteId,
    skippedTopics: [],
  }).getMemories();
  const memoriesWithValues = compactObject(updatedMemories);

  let updatedSkippedTopics = skippedTopics?.filter(
    (topic) => !memoriesWithValues[topic as Brainstorm.TopicName]
  ) as Brainstorm.TopicName[];

  return {
    memories: updatedMemories,
    skippedTopics: updatedSkippedTopics,
  };
};

export const summarizeAndSaveAnswers = async (
  messages: BaseMessage[],
  websiteId: number,
  skippedTopics: string[],
  threadId: string,
  jwt: string
): Promise<Partial<BrainstormGraphState>> => {
  let { memories, messages: taggedMessages } = await summarizeMessages(messages);
  if (!memories) {
    memories = { idea: "", audience: "", solution: "", socialProof: "" };
  }
  const { memories: updatedMemories, skippedTopics: updatedSkippedTopics } = await saveAnswers(
    memories,
    websiteId,
    skippedTopics,
    threadId,
    jwt
  );

  return {
    memories: updatedMemories,
    messages: taggedMessages,
    skippedTopics: updatedSkippedTopics,
  };
};

const answersSchema = z.array(
  z.object({
    topic: z.enum(Brainstorm.BrainstormTopics),
    answer: z.string(),
  })
);
type Answers = z.infer<typeof answersSchema>;

export const saveAnswersTool = tool(
  async (args: { answers?: Answers }, config) => {
    const state = getCurrentTaskInput<BrainstormGraphState>(config);
    const websiteId = state.websiteId;
    const threadId = state.threadId;
    const jwt = state.jwt;
    const skippedTopics = state.skippedTopics || [];

    if (!websiteId) {
      throw new Error("websiteId is required");
    }
    if (!threadId) {
      throw new Error("threadId is required");
    }
    if (!jwt) {
      throw new Error("jwt is required");
    }

    const toolMessage = new ToolMessage({
      content: "Saving answers...",
      tool_call_id: config?.toolCall.id,
      name: "saveAnswersTool",
    });

    // Model did not provide answers, so summarize the current thread
    if (!args.answers) {
      const currentMessages = state.messages;
      const stateUpdates = await summarizeAndSaveAnswers(
        currentMessages,
        websiteId,
        skippedTopics,
        threadId,
        jwt
      );

      return new Command({
        update: {
          ...stateUpdates,
          messages: [...(stateUpdates.messages || []), toolMessage],
        },
      });
    }

    const answersObject = args.answers.reduce(
      (acc, answer) => {
        acc[answer.topic as Brainstorm.TopicName] = answer.answer;
        return acc;
      },
      {} as Record<Brainstorm.TopicName, string>
    );

    const stateUpdates = await saveAnswers(answersObject, websiteId, skippedTopics, threadId, jwt);

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
