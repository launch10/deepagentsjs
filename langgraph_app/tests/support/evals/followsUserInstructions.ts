import { PromptTemplate } from "@langchain/core/prompts";
import { createScorer } from "./createScorer";

const template = PromptTemplate.fromTemplate(`
You are evaluating whether new content follows a user's specific request or direction.

[User Request]: {userRequest}

[Original Content]:
{originalContent}

[New Content]:
{output}

Evaluate whether the new content clearly reflects the user's request compared to the original.
The new content should demonstrate a meaningful shift in the direction the user requested.

For example, if the user asked for "more playful, funny headlines", the new headlines should
be noticeably more playful and humorous than the originals.

Available options:

{options}
`);

const choiceScores = {
  "strongly follows": 1, 
  "nearly follows": 0.9, 
  "good try": 0.75,
  "missed key points": 0.5, 
  "completely missed the point": 0
};

export interface FollowsUserInstructionsParams {
  userRequest: string;
  originalContent: string;
  output: string;
  useCoT?: boolean;
}

export const FollowsUserInstructionsScorer = createScorer({ 
  prompt: template, 
  choiceScores,
});
