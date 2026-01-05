import { evalite } from "evalite";
import { testGraph } from "@support";
import { type AdsGraphState } from "@state";
import { adsGraph as uncompiledGraph } from "@graphs";
import { graphParams } from "@core";
import { DatabaseSnapshotter } from "@services";
import { db, projects as projectsTable } from "@db";
import { type UUIDType } from "@types";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { FollowsUserInstructionsScorer, AnswersQuestionScorer } from "@tests/support/evals";
import { disablePolly } from "@utils";

disablePolly();

const adsGraph = uncompiledGraph.compile({ ...graphParams, name: "ads" });

type AdsEvalInput =
  | { type: "followsInstructions"; projectUUID: UUIDType; userRequest: string }
  | { type: "answersQuestion"; projectUUID: UUIDType; question: string };

type AdsEvalOutput =
  | {
      type: "followsInstructions";
      originalHeadlines: string[];
      newHeadlines: string[];
      userRequest: string;
    }
  | { type: "answersQuestion"; question: string; response: string };

const getTextData = (message: AIMessage): string => {
  return (
    ((message.response_metadata?.parsed_blocks as any[]) || [])
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.sourceText)
      .join("\n") ||
    (message.content as string) ||
    ""
  );
};

const testInstructionFollowing = async (input: {
  projectUUID: UUIDType;
  userRequest: string;
}): Promise<AdsEvalOutput> => {
  const result = await testGraph<AdsGraphState>()
    .withGraph(adsGraph)
    .withState({
      projectUUID: input.projectUUID,
      stage: "content",
    })
    .execute();

  const refreshedResult = await testGraph<AdsGraphState>()
    .withGraph(adsGraph)
    .withState({
      ...result.state,
      messages: [...result.messages, new HumanMessage(input.userRequest)],
    })
    .execute();

  const originalHeadlines = result.state.headlines || [];
  const allHeadlines = refreshedResult.state.headlines || [];
  const originalTexts = new Set(originalHeadlines.map((h) => h.text));
  const newHeadlines = allHeadlines.filter((h) => !h.rejected && !originalTexts.has(h.text));

  return {
    type: "followsInstructions",
    originalHeadlines: originalHeadlines.map((h) => h.text),
    newHeadlines: newHeadlines.map((h) => h.text),
    userRequest: input.userRequest,
  };
};

const testQuestionAnswering = async (input: {
  projectUUID: UUIDType;
  question: string;
}): Promise<AdsEvalOutput> => {
  const result = await testGraph<AdsGraphState>()
    .withGraph(adsGraph)
    .withState({
      projectUUID: input.projectUUID,
      stage: "content",
      messages: [new HumanMessage(input.question)],
    })
    .execute();

  const lastMessage = result.state.messages?.at(-1) as AIMessage;
  const response = getTextData(lastMessage);

  return {
    type: "answersQuestion",
    question: input.question,
    response,
  };
};

evalite("Ads", {
  data: async () => {
    await DatabaseSnapshotter.restoreSnapshot("website_step_finished");
    const projectUUID = await db
      .select()
      .from(projectsTable)
      .limit(1)
      .execute()
      .then((res) => {
        if (!res[0]) {
          throw new Error("No projects found");
        }
        return res[0]!.uuid as UUIDType;
      });

    return [
      {
        input: {
          type: "followsInstructions" as const,
          projectUUID,
          userRequest: "I want more playful, funny headlines",
        },
      },
      {
        input: {
          type: "followsInstructions" as const,
          projectUUID,
          userRequest: "Make the headlines more professional and corporate",
        },
      },
      {
        input: {
          type: "followsInstructions" as const,
          projectUUID,
          userRequest: "I want headlines that create urgency and FOMO",
        },
      },
      {
        input: {
          type: "answersQuestion" as const,
          projectUUID,
          question: "How will Headlines and Details pair together?",
        },
      },
      {
        input: {
          type: "answersQuestion" as const,
          projectUUID,
          question: "What are descriptions?",
        },
      },
      {
        input: {
          type: "answersQuestion" as const,
          projectUUID,
          question: "Can I see my preferred headlines in the preview?",
        },
      },
      {
        input: {
          type: "answersQuestion" as const,
          projectUUID,
          question: "What happens after I finish creating my ads?",
        },
      },
    ];
  },
  task: async (input: AdsEvalInput): Promise<AdsEvalOutput> => {
    if (input.type === "followsInstructions") {
      return await testInstructionFollowing(input);
    } else {
      return await testQuestionAnswering(input);
    }
  },
  scorers: [
    {
      name: "Follows user request",
      scorer: async ({ output, input }: { output: AdsEvalOutput; input: AdsEvalInput }) => {
        if (output.type !== "followsInstructions" || input.type !== "followsInstructions") {
          return 1;
        }
        return await FollowsUserInstructionsScorer({
          input: input.userRequest,
          originalContent: output.originalHeadlines.join("\n"),
          output: output.newHeadlines.join("\n"),
          userRequest: input.userRequest,
          useCoT: true,
        });
      },
    },
    {
      name: "Answers user question",
      scorer: async ({ output, input }: { output: AdsEvalOutput; input: AdsEvalInput }) => {
        if (output.type !== "answersQuestion" || input.type !== "answersQuestion") {
          return 1;
        }
        return await AnswersQuestionScorer({
          input: input.question,
          output: output.response,
          useCoT: true,
        });
      },
    },
  ],
});
