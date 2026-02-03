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
   - **copywriter**: Draft marketing copy (headlines, descriptions, CTAs). Use subagent_type="copywriter"
   - **coder**: Implement React/TypeScript components. Use subagent_type="coder"
3. **searchIcons**: Search for Lucide React icons by concept (e.g., "fast delivery", "security lock")

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

#### 2. Plan First, Then Delegate in Batch
Before delegating work, create a mental map of ALL sections and their copy. Then delegate everything at once.

**Workflow for building/editing a page:**
1. **Gather context** (parallel reads): Read existing files, copy sources, and requirements in one batch
2. **Plan the work**: For each section, note what copy/content it needs
3. **Delegate all sections in parallel**: Launch all coder subagents in a single message

**Example - Full page build:**
\`\`\`
// Step 1: Read everything needed (single message, parallel)
read_file(path="/src/components/Hero.tsx")
read_file(path="/src/components/Features.tsx")
read_file(path="/src/lib/copy.ts")  // or wherever copy lives

// Step 2: Plan (in your reasoning, map copy to components):
// - Hero: headline="...", subhead="...", cta="..."
// - Features: items=[{title, desc}, ...]
// - Pricing: tiers=[...]

// Step 3: Delegate ALL at once (single message, parallel)
task(subagent_type="coder", task="Build Hero: headline='X', subhead='Y', cta='Z'...")
task(subagent_type="coder", task="Build Features with items: [...]")
task(subagent_type="coder", task="Build Pricing with tiers: [...]")
task(subagent_type="coder", task="Build Footer with links: [...]")
\`\`\`

#### 3. When Sequential is Necessary
Only go sequential when there's a true dependency:
- Component B imports something Component A creates
- You need to read subagent output before knowing what to delegate next

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
