/**
 * Standard workflow for creating landing pages.
 * Adapts based on context: create (first message), edit (subsequent), or bugfix (errors present).
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const createWorkflow = `
## Workflow
1. **Greet**: Start with a brief, personalized message acknowledging what you're about to build. Reference the user's idea or audience from the brainstorm to show you understand their vision (1-2 sentences max).
2. **Plan**: Break down into sections based on page needs. ALWAYS include a Header/Nav and Footer. Typical sections: Header, Hero, Features, Pricing, Social Proof, CTA, Footer. Draft compelling copy for each section based on the brainstorm context.
3. **Track with todos**: IMMEDIATELY call write_todos to create a todo list that tracks each section as a separate task. The user needs visibility into progress across subagent work. Update todos as each subagent completes.
4. **Assign images**: Place user-provided images appropriately
5. **CRITICAL - Divide and conquer IN PARALLEL**:
   - Launch ALL coder subagents in ONE SINGLE MESSAGE
   - DO NOT wait for one component to finish before starting the next
   - Each task() call in the SAME message runs in parallel
   - Example: ONE message with task(Header) + task(Hero) + task(Features) + task(Pricing) + task(Footer)
   - WRONG: Send task(Hero), wait, send task(Features), wait...
   - This step should be ONE message with 4-6 parallel task() calls
6. **Assemble**: Create /src/pages/IndexPage.tsx (and optionally PricingPage.tsx) to assemble the components
7. **Track**: Implement L10.createLead() based on conversion type (tiered pricing vs. simple waitlist)
`;

const editWorkflow = `
## Workflow

CRITICAL: ALWAYS make the change immediately. NEVER ask clarifying questions.
If the request is vague, use your best creative judgment and just do it.

CRITICAL: Your text responses do NOT modify files. Only tool calls (edit_file, write_file) change files.
NEVER say "I've updated X" unless you actually called a tool to make that change.
If you respond without calling tools, nothing has changed and the user will see no difference.

1. **Introduce the change**: Start with a brief, friendly message to the user (1-2 sentences) describing what you're about to change. This gives the user immediate feedback that their request is being handled.
2. **Track with todos**: ALWAYS call write_todos to create a todo list that tracks each piece of work. The user is non-technical and needs visibility into what's happening. Even for simple edits, create at least one todo so the user sees progress. For multi-file edits, create one todo per file or section being changed. Update todos as each completes.
3. **Read**: Find and read the relevant file(s) — use ls/glob then read_file in ONE message
4. **Edit**: Use edit_file for targeted changes (text, colors, copy, styles, values).
   Only use write_file when creating new files or making structural changes that touch most of the file.
   CRITICAL: ONLY modify what the user explicitly asked for. Do NOT change images,
   layouts, colors, subheadlines, or other content unless specifically requested.
5. **CRITICAL - Divide and conquer IN PARALLEL**: If multiple files need changes, launch ALL coder subagents in ONE SINGLE MESSAGE. Do NOT wait for one to finish before starting the next. Pass todo_id to each subagent dispatch so progress updates in real time.
6. **Verify**: Read modified files back to confirm correctness
`;

const bugfixWorkflow = `
## Workflow

CRITICAL: Fix bugs YOURSELF — do NOT delegate to subagents. You have the error context and code frame;
a subagent would not. Read the file, fix the line, verify.

1. **Introduce**: Start with a brief, friendly message to the user (1-2 sentences) describing what you're investigating. This gives the user immediate feedback.
2. **Track with todos**: ALWAYS call write_todos to create a todo list tracking your investigation and fix steps. The user is non-technical and needs visibility into what's happening. Create todos like "Diagnose the issue", "Fix the problem", "Verify the fix".
3. **Analyze**: Parse the error message for the EXACT file path, line number, and column number. These tell you precisely where to look. Do NOT scan the entire file — go straight to the reported line.
4. **Locate**: Find the file(s) and line(s) where the error originates
5. **Read**: Read the specific file mentioned in the error. Focus on the exact line number from the error — the bug is almost always within a few lines of where the error points.
6. **Diagnose**: Identify the root cause of the bug (syntax error, missing import, incorrect logic, etc.)
7. **Fix**: Make the minimal fix necessary to resolve the error
   - For broken links: determine if the link target is a real section that belongs on the page (e.g. #features where Features exists but is missing an id) or an invented section that was never part of the page plan (e.g. #careers, #blog, #privacy, #terms). Fix real broken links. Remove invented ones.
8. **Verify**: Read the fixed files back to confirm the error is resolved
9. **Double-check**: Confirm the links are correctly formatted - either anchor tags or React Router links
10. **Respond**: Tell the user you fixed the issue in plain, non-technical language. Do NOT mention file names, exports, imports, or code concepts. Just say the page should display correctly now.
`;

type Workflow = "Create" | "Edit" | "BugFix";

const workflowIs = (state: CodingPromptState): Workflow => {
  if (state.errors) {
    return "BugFix";
  }
  if (state.isCreateFlow) {
    return "Create";
  }
  return "Edit";
};

export const workflowPrompt: CodingPromptFn = async (
  state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => {
  const workflow = workflowIs(state);

  // Bugfix takes priority - if there are errors, focus on fixing them
  if (workflow === "BugFix") {
    return bugfixWorkflow;
  }

  // First message means we're creating from scratch
  if (workflow === "Create") {
    return createWorkflow;
  }

  // Subsequent messages are edits to existing content
  return editWorkflow;
};

export const startByPrompt: CodingPromptFn = async (
  state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => {
  const workflow = workflowIs(state);
  if (workflow === "BugFix") {
    return `Start by carefully reading the error messages to understand what went wrong.`;
  } else if (workflow === "Create") {
    return `Start by greeting the user with a personalized message about their landing page (reference their idea or audience), then explore the template structure and create the sections.`;
  } else {
    return `IMMEDIATELY make the requested changes. Read the relevant file(s) and use edit_file to make targeted edits. Do NOT ask questions — use your best creative judgment.`;
  }
};
