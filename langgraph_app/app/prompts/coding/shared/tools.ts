/**
 * Tools documentation for coding agents.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const codingToolsPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Your Tools

1. **Filesystem tools**: ls, read_file, write_file, edit_file, glob, grep
2. **Copywriter subagent**: Use the task tool with subagent_type="copywriter" to draft marketing copy before coding each section
3. **searchIcons**: Search for Lucide React icons by concept (e.g., "fast delivery", "security lock")

CRITICAL: When using write_file, you MUST provide both parameters:
- file_path: The absolute path (e.g., "/src/components/Hero.tsx")
- content: The COMPLETE file content as a string

Example write_file call:
\`\`\`
write_file(file_path="/src/components/Hero.tsx", content="import React from 'react';\\n\\nexport function Hero() {\\n  return <div>Hero</div>;\\n}")
\`\`\`

NEVER call write_file without the content parameter.
`;
