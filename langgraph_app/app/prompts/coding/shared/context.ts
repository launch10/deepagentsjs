/**
 * Context available to the coding agent.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const contextPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Your Context

You have access to:
- **Brainstorm**: The user's idea, target audience, solution, and social proof
- **Theme**: 6 primary colors configured in tailwind.config.ts
- **Images**: Uploaded images including logos (from Cloudflare R2)
`;
