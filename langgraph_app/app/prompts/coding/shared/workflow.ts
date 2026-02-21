/**
 * Standard workflow for creating landing pages.
 * Adapts based on context: create (first message), edit (subsequent), or bugfix (errors present).
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const createWorkflow = `
## Workflow — Build Everything Yourself, Sequentially

**You are the sole builder. Do NOT delegate sections to subagents.**
Build each section yourself so you can see what you already built and maintain visual coherence.

1. **Greet**: Brief personalized message referencing the user's idea/audience (1-2 sentences max).

2. **Read the current theme**: Read \`/src/index.css\` to see the current color palette.
   This is a starting point, not gospel. Your design vision is the higher authority.
   If the theme colors don't serve your aesthetic direction, you WILL use \`change_color_scheme\`
   to make the palette match your vision. Don't compromise bold design for default colors.

3. **Design Brief** (MANDATORY — do NOT skip):
   Commit to a specific aesthetic vision. You are the creative director AND the builder.

   Your Design Brief MUST define:
   a) **Aesthetic direction**: Name it concretely. Not "modern and clean" — something with real identity. "Retro broadcast studio", "editorial magazine spread", "neon-noir cyberpunk", "sun-bleached California surf", "brutalist concrete gallery". The name should instantly evoke a visual world.
   b) **Font pairing**: Specific display font + body font from Google Fonts. The display font is the personality; the body font is the workhorse. Be specific: "Playfair Display for headlines, Source Sans 3 for body."
   c) **The one memorable thing**: What will someone remember 10 seconds after seeing this page? A dramatic oversized hero? A diagonal split layout? An unexpected color inversion? An atmospheric background that sets a mood? Name it and commit.
   d) **Section rhythm**: Map the background flow. Example: "Hero: bg-primary (dramatic) → Features: bg-muted (breathing room) → Testimonials: bg-background (clean) → CTA: bg-primary (bookend)."
   e) **Color personality**: How will color be used beyond defaults? Gradients? Accent pops on key words? Atmospheric overlays? Glow effects? If the current index.css palette doesn't serve this vision, call \`change_color_scheme\` now.

4. **Plan sections + copy**: Break into sections (always Header/Nav + Footer). Draft copy for each. Typical: Header, Hero, Features/Problem, Solution, Social Proof, CTA, Footer.

5. **Track with todos**: IMMEDIATELY call write_todos tracking each section. Update as you complete each one.

6. **Set up fonts**: Write Google Font links into /index.html <head> BEFORE building sections.

7. **Assign images**: Place user-provided images appropriately.

8. **Build sections sequentially — YOU, not subagents**:
   Build each section yourself in this order. After each, you can see what you built,
   so the next section stays visually coherent with the previous ones.

   Build order:
   a) **Hero** — establishes the visual language for the entire page
   b) **Header/Nav** — matches the hero's energy
   c) **Middle sections** (Features, Social Proof, etc.) — follow the rhythm from your brief
   d) **CTA** — bookend that echoes the hero
   e) **Footer** — clean closing

   For each section: write the component file, then move to the next.

9. **Assemble**: Create /src/pages/IndexPage.tsx to assemble all components.

10. **Self-review**: Read back your Hero, one middle section, and the CTA.
    Check: Are fonts consistent? Does the rhythm hold? Any drift from the Design Brief?
    Fix anything that drifted.

11. **Track**: Add lead capture using the LeadForm component.
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
    return `Start by greeting the user, then read /src/index.css to see the current theme colors. Write your Design Brief — commit to a bold aesthetic. If the current colors don't serve your vision, use change_color_scheme to make them match. Your design sense is the authority.

REMEMBER: Build this page YOURSELF. Do NOT delegate sections to subagents.`;
  } else {
    return `IMMEDIATELY make the requested changes. Read the relevant file(s) and use edit_file to make targeted edits. Do NOT ask questions — use your best creative judgment.`;
  }
};
