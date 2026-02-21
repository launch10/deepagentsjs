Single-Agent Sequential Create Flow

Context

The coding agent's create flow dispatches 7 parallel coder subagents to build sections
simultaneously. Despite adding a Design Brief step and creative director energy, the results are
still generic:

1.  7 subagents = no cohesion — each independently interprets the brief, producing a "frankenstein"
    page
2.  Agent chose Inter — despite being banned in 3 places, because the ban is buried in a massive
    prompt AND fonts.ts literally recommends "Clean SaaS: Sora + Inter" as a pairing
3.  Theme disconnect — agent invents an aesthetic without reading the actual theme colors first

Evidence: A single-agent edit flow (Trace 2) produced beautiful, cohesive results because one agent
built everything sequentially. The parallel create flow (Trace 3) produced generic results despite
having the Design Brief.

Fix: For create flow only, disable subagent delegation. The main agent builds all sections itself,
sequentially, seeing what it already built. Edit flow is unchanged.

Files to Modify (4 files)

1.  langgraph_app/app/nodes/website/websiteBuilder.ts

Pass subagents: [] when isCreate is true (line ~171):

return createCodingAgent(agentState, {
messages: prepared,
config,
recursionLimit: isCreate ? 150 : 100,
// Create flow: disable coder subagent. Main agent builds all sections
// sequentially for visual coherence (sees what it already built).
// General-purpose subagent still exists (hardcoded in createDeepAgent)
// but workflow instructs agent to build everything directly.
...(isCreate && { subagents: [] }),
});

Also update the comment at lines 141-143 that explains why subagents aren't conditionally removed —
it's now outdated for create flow.

2.  langgraph_app/app/prompts/coding/shared/workflow.ts

Rewrite createWorkflow — sequential build, no delegation, theme-aware Design Brief:

Key changes from current:

- New step 2: Read /src/index.css to understand theme colors BEFORE designing
- Design Brief (step 3): Add explicit BANNED FONTS box with visual separators (====)
- Replace step 7 "Divide and conquer IN PARALLEL" with "Build sections sequentially — YOU, not
  subagents"
- Add step 9 self-review: agent reads back its own work to catch drift
- Bold header: "Do NOT use the task tool. Do NOT delegate."

Build order: Hero first (establishes visual language) → Header → middle sections → CTA → Footer

Rewrite startByPrompt for Create — triple-reinforce no-delegation + font ban:

Start by greeting the user, then IMMEDIATELY read /src/index.css to see the theme colors.
Write your Design Brief — commit to a bold aesthetic that HARMONIZES with those colors.

REMEMBER: Build this page YOURSELF. Do NOT use the task tool. Do NOT delegate.
FONT REMINDER: NEVER use Inter, Roboto, Arial, Open Sans, or Lato.

Edit and BugFix startByPrompt unchanged.

3.  langgraph_app/app/prompts/coding/shared/tools.ts

Revert section 2 from "Design Brief First, Then Delegate in Batch" (which references the now-removed
delegation workflow) to generic delegation guidance for the edit flow:

#### 2. Parallel Subagent Delegation (for multi-file edits)

When editing multiple files, delegate to coder subagents in parallel.

Example:
read_file(Hero.tsx) + read_file(Features.tsx) // parallel reads
task("Update Hero headline...") + task("Change Features layout...") // parallel edits

This is in the STATIC prefix (cached). We can't condition it on isCreateFlow. But the DYNAMIC
workflow suffix ("do NOT delegate") overrides it for create flow.

4.  langgraph_app/app/prompts/coding/shared/design/fonts.ts

Fix the contradictions that actively undermine the font ban:

- Line 37: Remove "Clean SaaS | Sora | Inter" — recommends the exact font we ban
- Line 27 + Line 35: Replace Space Grotesk as the default example — the SKILL.md says "NEVER
  converge on common choices (Space Grotesk, for example)"
- Replace with more distinctive examples

What Does NOT Change

- role.ts — Already has creative director energy from previous change
- coder.ts — Still used by edit flow subagents
- designPhilosophy.ts — Already bans Inter in SKILL.md
- designChecklist.ts — Self-review checklist still applies
- agent.ts — Prompt assembly, buildFullCodingAgent, routing all unchanged
- Edit flow — Still uses parallel coder subagents
- Bugfix flow — Still says "fix bugs YOURSELF"

Why the Agent Will Follow "Do NOT Delegate"

Concern: generalPurposeAgent: true is hardcoded in createDeepAgent, so the task() tool and its
~200-line TASK_SYSTEM_PROMPT still exist. Will the agent ignore our instructions?

Mitigations (layered):

1.  No coder subagent — task() only offers "general-purpose", no "coder" option
2.  Triple repetition — "do NOT delegate" appears in workflow header, step 6, and startByPrompt
3.  Last-word advantage — workflow is in the DYNAMIC suffix, which comes AFTER the TASK_SYSTEM_PROMPT
4.  Behavioral alignment — the workflow gives clear sequential steps; delegating would mean skipping
    those steps

If testing shows the agent still delegates, escalation path: add a taskSystemPrompt: null option to
createDeepAgent in deepagentsjs to suppress the TASK_SYSTEM_PROMPT entirely.

Verification

1.  Create a new landing page from brainstorm → check LangSmith trace:

- Agent reads /src/index.css before writing Design Brief
- Design Brief does NOT name Inter, Roboto, or Arial
- Zero task() tool calls (agent builds everything itself)
- Fonts are distinctive and loaded in index.html
- Visual coherence across all sections

2.  Edit flow regression — run an edit, verify coder subagents still work
3.  Visual comparison — compare new page against the old generic output
