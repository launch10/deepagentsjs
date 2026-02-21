The Full Story: Why Trace 2 Was Amazing and Trace 1 Was Ugly

The Setup (identical in both)

Both traces share the same 27,481-char system prompt on the main coding-agent. This prompt includes
all the design guidance, quality gates, "avoid generic AI slop" instructions, and the full aesthetic
direction toolkit. The design skill IS included in both.

What the user said

Trace 1 (Bad): "Create a landing page for this business"
Trace 2 (Good): "ew it looks uncool. make it look really cool please. I need the full agent for
this"

What the agent did

Trace 1 — The agent immediately:

1. Wrote 7 todos (one per component)
2. Dispatched 7 parallel coder subagents — Header, Hero, Problem, Solution, SocialProof, CTA, Footer
3. Each subagent got ~600-1100 chars of component description
4. Each subagent wrote their file from scratch (write_file x8, edit_file x0)
5. Assembled the index page

Trace 2 — The agent:

1. Wrote 1 todo ("Redesign the entire landing page")
2. Dispatched exactly 1 general-purpose subagent with a 2,905-char creative brief ("REDESIGN
   MISSION")
3. That single subagent:
   - Read 9 existing files to understand the codebase
   - Chose "RETRO PODCAST STUDIO AESTHETIC" as the direction
   - Searched for icons (SearchIconsTool x2)
   - Edited every component sequentially (edit_file x12, write_file x0)
   - Updated fonts, CSS, then each component one-by-one

The 5 Factors That Made Trace 2 Amazing

1. Coder subagents are BLIND to design context (the killer issue)

The 27k-char system prompt with all the design guidance lives on the main coding-agent. When Trace 1
dispatched 7 coder subagents, each one only got its component description (~800 chars). No design
philosophy, no quality gates, no aesthetic direction. They each wrote generic code in isolation.

In Trace 2, the main agent wrote a rich creative brief as the task description:

- Brand assets + logo description ("playful circular badge with retro vibe")
- Specific theme colors (#264653, #2A9D8F, #E9C46A, #F4A261, #E76F51)
- Design direction suggestions (retro/vintage, brutalist, editorial)
- Quality gates ("Would someone remember this page 3 seconds after seeing it?")
- "Make this landing page COOL. Make it something the user will be proud to show off."

2. edit_file vs write_file = coherence vs chaos

┌────────────┬─────────┬─────────┐
│ │ Trace 1 │ Trace 2 │
├────────────┼─────────┼─────────┤
│ write_file │ 8 │ 0 │
├────────────┼─────────┼─────────┤
│ edit_file │ 0 │ 12 │
└────────────┴─────────┴─────────┘

Trace 2's subagent read every file first, then edited the existing structure. Each edit built on the
previous one with a coherent vision. Trace 1's subagents each wrote brand new files from a blank
canvas with no shared context.

3. Sequential coherence > parallel isolation

Trace 2's single agent edited components one-by-one: fonts → CSS → Header → Hero → Problem →
Solution → SocialProof → CTA → Footer → Button/Input components. Each change informed the next. The
agent evolved a coherent design language as it went.

Trace 1's 7 parallel agents had no visibility into each other's work. Seven islands of code, no
shared aesthetic.

4. general-purpose vs coder subagent type

Trace 2 used general-purpose (full agent capabilities). Trace 1 used coder (presumably more
constrained, write-focused). The general-purpose subagent could read, think, search icons, and
iterate — not just write code.

5. The user's words actually mattered

"I need the full agent for this" directly influenced the agent to NOT parallelize. "Make it look
really cool" triggered an emotionally-charged creative brief rather than mechanical component specs.

Summary Table

Factor: User message
Trace 1 (Bad, 110s): "Create a landing page"
Trace 2 (Good, 364s): "make it really cool, I need the full agent"
────────────────────────────────────────
Factor: Subagent count
Trace 1 (Bad, 110s): 7 parallel (coder)
Trace 2 (Good, 364s): 1 sequential (general-purpose)
────────────────────────────────────────
Factor: Design context to subagents
Trace 1 (Bad, 110s): ~800 chars per component
Trace 2 (Good, 364s): 2,905 chars creative brief
────────────────────────────────────────
Factor: Write approach
Trace 1 (Bad, 110s): write_file x8 (from scratch)
Trace 2 (Good, 364s): edit_file x12 (targeted edits)
────────────────────────────────────────
Factor: Files read first
Trace 1 (Bad, 110s): 4
Trace 2 (Good, 364s): 13
────────────────────────────────────────
Factor: Design system prompt seen by workers
Trace 1 (Bad, 110s): NO
Trace 2 (Good, 364s): Baked into the task description
────────────────────────────────────────
Factor: Time
Trace 1 (Bad, 110s): 110s
Trace 2 (Good, 364s): 364s (3.3x more)

Actionable Takeaways

1. Coder subagents need design context — Either pass the design guidance in the task description
   (like Trace 2 did accidentally) or inject the design system prompt into the coder subagent's own
   system prompt
2. Consider defaulting to edit_file over write_file for redesigns — reading existing code first
   produces far better results
3. The parallel delegation pattern needs a "design brief" step — Before dispatching 7 subagents, the
   main agent should establish the aesthetic direction and pass it to ALL subagents
4. "Full agent" mode might be worth offering — A single agent doing everything sequentially (364s)
   produced dramatically better results than 7 parallel agents (110s). Speed isn't everything.
