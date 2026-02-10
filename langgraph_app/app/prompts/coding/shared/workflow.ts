/**
 * Standard workflow for creating landing pages.
 * Adapts based on context: create (first message), edit (subsequent), or bugfix (errors present).
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const createWorkflow = `
## Workflow
1. **Greet**: Start with a brief, personalized message acknowledging what you're about to build. Reference the user's idea or audience from the brainstorm to show you understand their vision (1-2 sentences max).
2. **Plan**: Break down into sections (e.g. Hero, Features, Pricing, Social Proof, CTA, Footer) based on page needs. Draft compelling copy for each section based on the brainstorm context.
3. **Track with todos**: IMMEDIATELY call write_todos to create a todo list that tracks each section as a separate task. The user needs visibility into progress across subagent work. Update todos as each subagent completes.
4. **Assign images**: Place user-provided images appropriately
5. **CRITICAL - Divide and conquer IN PARALLEL**:
   - Launch ALL coder subagents in ONE SINGLE MESSAGE
   - DO NOT wait for one component to finish before starting the next
   - Each task() call in the SAME message runs in parallel
   - Example: ONE message with task(Hero) + task(Features) + task(Pricing) + task(Footer)
   - WRONG: Send task(Hero), wait, send task(Features), wait...
   - This step should be ONE message with 4-6 parallel task() calls
6. **Assemble**: Create /src/pages/IndexPage.tsx (and optionally PricingPage.tsx) to assemble the components
7. **Track**: Implement L10.createLead() based on conversion type (tiered pricing vs. simple waitlist)
`;

const editWorkflow = `
## Workflow

CRITICAL: ALWAYS make the change immediately. NEVER ask clarifying questions.
If the request is vague, use your best creative judgment and just do it.

1. **Read**: Find and read the relevant file(s) — use ls/glob then read_file in ONE message
2. **Track with todos**: If this edit touches multiple files or requires subagent delegation, call write_todos to create a todo list so the user has visibility into progress. Each subagent dispatch counts as a tracked task.
3. **Edit**: Use edit_file for targeted changes (text, colors, copy, styles, values).
   Only use write_file when creating new files or making structural changes that touch most of the file.
   CRITICAL: ONLY modify what the user explicitly asked for. Do NOT change images,
   layouts, colors, subheadlines, or other content unless specifically requested.
4. **CRITICAL - Divide and conquer IN PARALLEL**: If multiple files need changes, launch ALL coder subagents in ONE SINGLE MESSAGE. Do NOT wait for one to finish before starting the next.
5. **Verify**: Read modified files back to confirm correctness
`;

const bugfixWorkflow = `
## Workflow

1. **Analyze**: Carefully read the error messages to understand what went wrong
2. **Locate**: Find the file(s) and line(s) where the error originates
3. **Read**: Read the relevant code to understand the current implementation
4. **Diagnose**: Identify the root cause of the bug (syntax error, missing import, incorrect logic, etc.)
5. **Fix**: Make the minimal fix necessary to resolve the error
6. **Verify**: Read the fixed files back to confirm the error is resolved
7. **Double-check**: Confirm the links are correctly formatted - either anchor tags or React Router links
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
