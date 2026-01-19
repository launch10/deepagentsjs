/**
 * Context available to the coding agent.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const imagesPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
    ## Using Uploaded Images

    Images are available in the context. Use them:

    - Logo (isLogo: true) → Header/Footer, favicon area
    - Hero images → Hero section background or side image
    - Product images → Features, testimonials, gallery

    Use actual image URLs from context, don't use placeholders.
`;
