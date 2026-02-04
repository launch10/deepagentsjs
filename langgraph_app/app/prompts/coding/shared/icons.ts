/**
 * Component guidelines for landing page development.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const iconsPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
    ### Icons - IMPORTANT

    **Use the \`searchIcons\` tool to find Lucide React icons.**

    **NEVER grep or search the codebase for "lucide-react" imports.**
    - DO NOT: \`grep lucide-react\`
    - DO NOT: \`grepRaw from.*lucide-react\`
    - DO NOT: search for existing icon imports

    Instead, call searchIcons with the concepts you need:
    \`\`\`
    searchIcons(queries: ["navigation", "settings", "checkmark", "arrow"], limit: 3)
    \`\`\`

    The tool returns icon names you can import directly: \`import { Menu, Settings, Check, ArrowRight } from 'lucide-react'\`
`;
