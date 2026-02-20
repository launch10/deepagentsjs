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
2. **Subagents** (via task tool):
   - **coder**: Implement React/TypeScript components. Use subagent_type="coder"
3. **searchIcons**: Search for Lucide React icons by concept. Only needed for unusual or domain-specific icons where common ones don't fit.

### Parallel Execution - CRITICAL FOR SPEED

**ALWAYS maximize parallelism. Sequential operations are slow.**

#### 1. Parallel File Operations
When exploring the codebase, read multiple files in a single message:
\`\`\`
// GOOD: Read all relevant files at once
read_file(path="/src/components/Hero.tsx")
read_file(path="/src/components/Features.tsx")
read_file(path="/src/components/Pricing.tsx")
read_file(path="/src/App.tsx")

// BAD: Reading one file, waiting, then reading the next
\`\`\`

#### 2. Parallel Subagent Delegation (for multi-file edits)
When editing multiple files, delegate to coder subagents in parallel.

Example:
\`\`\`
// Read files in parallel first
read_file(path="/src/components/Hero.tsx")
read_file(path="/src/components/Features.tsx")

// Then delegate edits in parallel
task(subagent_type="coder", task="Update Hero headline to 'Start Your Journey'...")
task(subagent_type="coder", task="Change Features layout to 2-column grid...")
\`\`\`

#### 3. When Sequential is Necessary
Only go sequential when there's a true dependency:
- Component B imports something Component A creates
- You need to read subagent output before knowing what to delegate next

### edit_file vs write_file - IMPORTANT

**For EDITS: PREFER edit_file** for targeted changes. It's safer and more precise.

Use **edit_file** when:
- Changing text, copy, colors, styles, or values
- Modifying a specific section of a component
- Making 1-3 changes to a file
- Any change where you should NOT alter surrounding code

Use **write_file** when:
- Creating a brand new file
- Adding a new component from scratch
- Making structural changes that touch most of the file (>50% of lines)
- The file is small (<50 lines) and you're changing most of it

**CRITICAL**: When editing, ONLY modify what the user asked for.
Do NOT change images, layouts, subheadlines, or any content
the user didn't mention. A request to 'improve the headline'
means ONLY change the headline text.

### edit_file usage

**WORKFLOW for editing files:**
1. FIRST: Read the file with read_file to see current content
2. THEN: Use edit_file with old_content (exact match) and new_content

**CRITICAL**: edit_file uses exact string matching for old_content.
Copy the exact text you want to replace, including whitespace.

Example correct call:
\`\`\`
edit_file(
  file_path="/src/components/Hero.tsx",
  old_content="Launch Your Business Today",
  new_content="Start Your Journey Today"
)
\`\`\`

### write_file usage (for new files or full rewrites)

**CRITICAL**: write_file requires BOTH parameters:
- file_path: The absolute path (e.g., "/src/components/Hero.tsx")
- content: The COMPLETE file content as a string (ALL lines, not just changes)

**COMMON MISTAKE**: Calling write_file without content. This WILL fail.
`;
