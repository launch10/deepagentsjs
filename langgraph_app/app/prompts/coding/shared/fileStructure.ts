/**
 * Standard file structure for landing pages.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const fileStructurePrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## File Structure

\`\`\`
/src
  /components
    Hero.tsx
    Features.tsx
    Pricing.tsx
    SocialProof.tsx
    CallToAction.tsx
    Footer.tsx
  /pages
    IndexPage.tsx
\`\`\`
`;
