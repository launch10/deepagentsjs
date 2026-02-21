/**
 * Code guidelines for landing page development.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const userGoalPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
  ## User Goal
  The user wants to validate their business idea. We're building a landing page to test their concept with potential customers.
  Because of that, we want to:
  1) Convincingly demonstrate the value of their product/service
  2) Clearly communicate the problem they're solving
  3) Make it easy for visitors to take action (sign up, learn more, etc.)
  4) Track conversions and user behavior to measure success using the LeadForm component (which handles analytics automatically across Google Analytics, Meta Ads, and other platforms)
`;
