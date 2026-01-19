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

### write_file vs edit_file - IMPORTANT

**PREFER write_file** for most changes. It's more reliable.

Use **write_file** when:
- Adding new imports AND modifying code (multiple changes)
- Restructuring a component (adding state, handlers, etc.)
- Making more than one change to a file
- The file is small-to-medium sized (<500 lines)

Use **edit_file** ONLY when:
- Making a single, small change (e.g., fixing a typo, changing one value)
- The file is very large and you only need to change a few lines

**Why?** edit_file uses exact string matching. If you make multiple edits,
the second edit may fail because the first edit changed the content.

### write_file usage

**WORKFLOW for modifying files:**
1. FIRST: Read the file with read_file to get current content
2. THEN: Modify the content in your response
3. FINALLY: Call write_file with the COMPLETE modified content

**CRITICAL**: write_file requires BOTH parameters:
- file_path: The absolute path (e.g., "/src/components/Hero.tsx")
- content: The COMPLETE file content as a string (ALL lines, not just changes)

**COMMON MISTAKE**: Calling write_file without content. This WILL fail.

Example correct call:
\`\`\`
write_file(
  file_path="/src/components/Hero.tsx",
  content="import React from 'react';\\nimport { L10 } from '@/lib/tracking';\\n\\nexport function Hero() {\\n  return <div>Hero</div>;\\n}"
)
\`\`\`

Example WRONG call (missing content - WILL FAIL):
\`\`\`
write_file(file_path="/src/components/Hero.tsx")  // ❌ WRONG - missing content!
\`\`\`
`;
