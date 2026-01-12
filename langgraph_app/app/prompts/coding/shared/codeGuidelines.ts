/**
 * Code guidelines for landing page development.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const codeGuidelinesPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Code Guidelines

- Use ONLY shadcn/ui components from the template
- Use ONLY theme color utilities (bg-primary, text-secondary-foreground, etc.)
- Never use hardcoded hex colors
- One component per file, under 150 lines
`;
