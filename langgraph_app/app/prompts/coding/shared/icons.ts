/**
 * Component guidelines for landing page development.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const iconsPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
    ### Icons

    Use **lucide-react** for all icons. Import by PascalCase name:
    \`import { ArrowRight, Check, Star } from 'lucide-react'\`

    You already know the full Lucide icon library — pick icons directly from your knowledge.
`;
