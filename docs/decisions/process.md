# Process: Decision History

> Decisions about how we work, document, and compound knowledge. Most recent first.

---

## Current State

Compound engineering philosophy: each unit of work should make subsequent work easier. Document decisions in `docs/decisions/` (by topic, with history). Create skills in `.claude/skills/` for operational how-to guides. Use `/decision` command to capture "why".

---

## Decision Log

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

- `docs/decisions/` - All decision history files
- `.claude/skills/` - Operational skills
- `.claude/commands/decision.md` - The `/decision` command
