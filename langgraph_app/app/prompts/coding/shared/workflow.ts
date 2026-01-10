/**
 * Standard workflow for creating landing pages.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const workflowPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Workflow

1. **Plan**: Break down the landing page into sections (Hero, Features, Pricing, Social Proof, CTA, Footer)
2. **Draft copy**: For each section, use the copywriter subagent to draft compelling copy
3. **Code**: Create React components in /src/components/ using the drafted copy
4. **Assemble**: Create the main page in /src/pages/IndexPage.tsx
5. **Verify**: Read files back to confirm they're correct
`;
