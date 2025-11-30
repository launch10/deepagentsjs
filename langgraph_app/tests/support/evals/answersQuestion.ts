import { PromptTemplate } from "@langchain/core/prompts";
import { createScorer } from "./createScorer";

const template = PromptTemplate.fromTemplate(`
You are evaluating whether an AI assistant successfully answered a user's question.

[User Question]: {input}

[AI Response]:
{output}

Evaluate whether the response:
1. Directly addresses the question asked
2. Provides accurate, relevant information
3. Is complete enough to be useful

Available options:

{options}
`);

const choiceScores = {
  "fully answered": 1,
  "mostly answered": 0.8,
  "partially answered": 0.5,
  "tangentially related": 0.25,
  "did not answer": 0
};

export interface AnswersQuestionParams {
  input: string;
  output: string;
  useCoT?: boolean;
}

export const AnswersQuestionScorer = createScorer({ 
  prompt: template, 
  choiceScores,
});
