/**
 * Standard workflow for creating landing pages.
 * Adapts based on context: create (first message), edit (subsequent), or bugfix (errors present).
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const createWorkflow = `
## Workflow

1. **Plan**: Break down the landing page into sections (Hero, Features, Pricing, Social Proof, CTA, Footer)
2. **Draft copy**: For each section, use the copywriter subagent to draft compelling copy
3. **Assign images**: For any images the user provided, decided where they should be placed in the landing page
4. **Code**: Create React components in /src/components/ using the drafted copy
5. **Assemble**: Create the main page in /src/pages/IndexPage.tsx and optionally /src/pages/PricingPage.tsx
6. **Add Analytics**: Identify the main conversion type (tiered pricing, simple waitlist, etc.), and implement the appropriate tracking using L10.createLead()
7. **Verify**: Read files back to confirm they're correct
`;

const editWorkflow = `
## Workflow

1. **Understand**: Read the user's request carefully to understand what changes they want
2. **Explore**: Use ls and glob to find the relevant files that need to be modified
3. **Read**: Read the existing code to understand the current implementation
4. **Plan**: Determine the minimal set of changes needed to fulfill the request
5. **Edit**: Make targeted edits to the existing files - avoid rewriting entire files when small changes suffice
6. **Verify**: Read the modified files back to confirm the changes are correct
`;

const bugfixWorkflow = `
## Workflow

1. **Analyze**: Carefully read the error messages to understand what went wrong
2. **Locate**: Find the file(s) and line(s) where the error originates
3. **Read**: Read the relevant code to understand the current implementation
4. **Diagnose**: Identify the root cause of the bug (syntax error, missing import, incorrect logic, etc.)
5. **Fix**: Make the minimal fix necessary to resolve the error
6. **Verify**: Read the fixed files back to confirm the error is resolved
`;

type Workflow = "Create" | "Edit" | "BugFix";

const workflowIs = (state: CodingPromptState) => {
  if (state.errors) {
    return "BugFix";
  }
  if (state.isFirstMessage) {
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
    return `Start by exploring the existing template structure with ls and glob, then create the landing page sections.`;
  } else {
    return `Start by exploring the existing website with ls and glob, then make the requested changes.`;
  }
};
