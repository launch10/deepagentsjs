import { PromptTemplate } from "@langchain/core/prompts";
import { createScorer } from "./createScorer";

const template = PromptTemplate.fromTemplate(`
  You are assessing a submitted answer on a given task based on a criterion. Here is the data:
  [BEGIN DATA]
  ***
  [Task]: {input}
  ***
  [Submission]: {output}
  ***
  [Criterion]: {criteria}
  ***
  [END DATA]
  Does the submission meet the criterion?
`);

const choiceScores = { Yes: 1, No: 0 };

export const createClosedQAScorer = (criteria: Record<string, unknown>) => createScorer({ prompt: template, choiceScores, additionalPromptParams: { criteria } })
