# Process: Decision History

> Decisions about how we work, document, and compound knowledge. Most recent first.

---

## Current State

Unified knowledge capture: after solving a problem, run `/compound` to extract all knowledge types automatically:
- Solutions → `docs/solutions/` (how we fixed it)
- Decisions → `docs/decisions/[topic].md` (why we chose this approach)
- Plans → marked complete in `plans/`

Use `/decision` directly when thinking about architecture (not fixing a bug).

---

## Decision Log

### 2025-12-28: Unify Knowledge Capture Under /compound Orchestration

**Context:** Three separate tools operated independently:
- `/compound` only created solution docs in `docs/solutions/`
- `/decision` documented architectural choices separately
- `plans/` had no completion tracking

Users had to remember which tool to use when. Knowledge capture was fragmented.

**Decision:** Make `/compound` the single "close the loop" workflow that:
1. Extracts solutions → `docs/solutions/`
2. Detects decisions → `docs/decisions/[topic].md` with temporal history
3. Matches plans → marks complete in `plans/`

**Why:**
- Single entry point after solving problems
- Automatically routes knowledge to the right place
- Decision Detector identifies "why" statements without user having to think about it
- Plans get completed as side effect, not forgotten
- Still allows `/decision` for direct architectural discussions

**Implementation:**
- Phase 1 (parallel): Context Analyzer, Solution Extractor, Decision Detector, Related Docs Finder, Prevention Strategist, Plan Matcher
- Phase 2 (sequential): Solution Writer, Decision Writer, Plan Completer
- Phase 3 (optional): Specialized agent reviews

**Status:** Current

---

### 2025-12-28: Adopt Topic-Based Decision Logs with History

**Context:** Individual decision files (one per decision) become contradictory over time. Decisions evolve but documentation doesn't reflect this.

**Decision:** Organize decisions by topic (authentication.md, architecture.md, etc.) with most recent at top, previous decisions marked as superseded.

**Why:**
- No contradictions - can't have two files saying different things about auth
- History preserved - know what we decided before and why we changed
- Easy to update - add to top, update status of old
- Agent reads one file, gets full picture including evolution

**Structure:**
```markdown
# [Topic]: Decision History

## Current State
[Brief summary of where we are now]

## Decision Log

### [Date]: [Decision Title]
**Context:** What prompted this?
**Decision:** What did we decide?
**Why:** The reasoning.
**Supersedes:** [Previous decision, if applicable]
**Status:** Current | Superseded by X
```

**Status:** Current

---

### 2025-12-28: Separate "Why" (Decisions) from "How" (Skills)

**Context:** Need to capture both architectural reasoning and operational procedures.

**Decision:**
- `docs/decisions/` = "Why" we made choices (evolving history)
- `.claude/skills/` = "How" to do things (operational, current)

**Why:**
- Different purposes require different structures
- Decisions evolve and need history
- Skills should be current and actionable
- Agents can find right type of docs for their need

**Status:** Current

---

### 2025-12-28: Adopt Compound Engineering Philosophy

**Context:** Traditional development accumulates technical debt. Every feature adds complexity.

**Decision:** Invert this: each feature should make subsequent work easier.

**Why:**

Each feature you build:
- Documents patterns for the next feature
- Creates reusable components that accelerate future work
- Establishes conventions that reduce decision fatigue
- Codifies knowledge that compounds across the team and agents

The compound effect over time:
- Agents have more context to make better decisions
- New team members onboard faster
- Less time explaining, more time building
- The codebase teaches itself

**What makes good documentation:**
- Explains "why" not just "what"
- Shows real commands/code examples
- Lives close to the code it describes
- Gets updated when code changes

**What to avoid:**
- YAML frontmatter and metadata schemas
- Manually maintained indexes
- Template ceremonies
- Stale documentation that lies

**Status:** Current

---

## Files Involved

- `docs/decisions/` - All decision history files (by topic)
- `docs/solutions/` - Solution documentation (by category)
- `.claude/skills/` - Operational skills
- `.claude/commands/decision.md` - The `/decision` command
- `~/.claude/plugins/.../compound-engineering/commands/workflows/compound.md` - The `/compound` orchestrator
- `plans/` - Project plans (with completion tracking)
