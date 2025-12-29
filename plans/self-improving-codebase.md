# Self-Improving Codebase

## Problem

We lack documentation explaining WHY architectural decisions were made. Knowledge exists in people's heads but isn't discoverable by agents or new team members.

## Solution

1. Create `docs/decisions/` folder
2. When we remember or discuss why something was built a certain way, write it down
3. Use plain markdown, no special format required
4. Use the existing `/compound` command after solving hard problems

## First Decisions to Document

Based on codebase analysis, these areas need "why" documentation:

- Why Langgraph is a separate service from Rails
- Why JWT authentication instead of sessions
- Why WebContainers for in-browser execution
- Why Inertia + React over API + SPA
- Why Drizzle read-only (Langgraph never modifies schema)

## Optional: Debugging Skill

If debugging tips in CLAUDE.md aren't sufficient, create one skill:
- `.claude/skills/debugging.md` - covers both Rails and Langgraph basics

## Done When

- `docs/decisions/` folder exists
- At least 1 decision document written

## References

- Model to follow: `atlas/docs/ROUTING_DEEP_DIVE.md` (narrative, explains "why")
- Existing skills: `rails_app/.claude/skills/*.md` (practical, operational)
