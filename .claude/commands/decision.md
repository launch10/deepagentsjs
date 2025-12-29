# Document a Decision

Capture why a decision was made. Decisions are **organized by topic** and **evolve over time**.

## Key Principle: Decisions Evolve

Decisions aren't static. Context changes, we learn, we override previous choices. The documentation should reflect this history - not hide it.

**Structure:**
```
docs/decisions/
├── authentication.md      # All auth decisions, with history
├── architecture.md        # Service split, patterns
├── testing.md            # Testing approach evolution
├── frontend.md           # Inertia, React, WebContainers
└── deployment.md         # Cloudflare, Atlas, etc.
```

Each file contains **one topic** with **multiple decisions over time**.

## Process

### 1. Identify the Topic

What's the top-level domain?
- `authentication` - JWT, sessions, tokens
- `architecture` - Service boundaries, patterns
- `testing` - Snapshots, Polly, scenarios
- `frontend` - Inertia, React, templates
- `deployment` - Cloudflare, Atlas, domains
- `data` - Schema ownership, migrations
- `product` - Vision, features, priorities

If no existing topic fits, create a new one.

### 2. Check for Existing Topic File

```bash
ls docs/decisions/
```

**If topic file exists:** Read it first, then ADD to it (don't replace).

**If no topic file:** Create new file with this structure.

### 3. Document the Decision

**For new topic files:**

```markdown
# [Topic]: Decision History

> Decisions about [topic area]. Most recent first.

---

## Current State

[Brief summary of where we are now]

---

## Decision Log

### [Date]: [Decision Title]

**Context:** What prompted this decision?

**Decision:** What did we decide?

**Why:** The reasoning.

**Trade-offs:** What we accepted.

**Status:** Current | Superseded by [link] | Deprecated

---
```

**For adding to existing topic files:**

Add a new entry at the TOP of the Decision Log (most recent first):

```markdown
### [Date]: [New Decision Title]

**Context:** What prompted this decision?

**Decision:** What did we decide?

**Why:** The reasoning.

**Supersedes:** [Previous decision title, if applicable]

**Status:** Current

---
```

Then update the "Current State" section to reflect the new reality.

If this supersedes a previous decision, update that decision's status:
```markdown
**Status:** Superseded by "[New Decision Title]" ([Date])
```

### 4. Consolidation Check

Before creating a new topic file, check if this belongs in an existing one:

| If about... | Add to... |
|-------------|-----------|
| JWT, sessions, tokens, auth flow | `authentication.md` |
| Service boundaries, Rails/Langgraph split | `architecture.md` |
| Snapshots, Polly, test patterns | `testing.md` |
| Inertia, React, WebContainers, templates | `frontend.md` |
| Cloudflare, Atlas, R2, domains | `deployment.md` |
| Schema, migrations, Drizzle | `data.md` |
| Product vision, features, priorities | `product.md` |

**Only create a new topic file if nothing fits.**

### 5. Confirm

After writing, say:

```
✓ Decision documented: docs/decisions/[topic].md

Added: [Decision title]
Status: [Current | Supersedes previous decision]

Topic now contains [N] decisions spanning [date range].
```

## Example: Decision Evolution

```markdown
# Authentication: Decision History

> Decisions about user authentication and service-to-service auth. Most recent first.

---

## Current State

JWT tokens issued by Rails, validated by Langgraph. 24-hour expiry.
Stored in httpOnly cookies. No session store needed.

---

## Decision Log

### 2025-12-28: Extend JWT expiry to 7 days

**Context:** Users complained about daily re-auth. Beta users are trusted.

**Decision:** Change JWT expiry from 24 hours to 7 days.

**Why:** Better UX for beta, can tighten later.

**Supersedes:** "24-hour JWT expiry" (2025-10-15)

**Status:** Current

---

### 2025-10-15: Use JWT with 24-hour expiry

**Context:** Need auth between Rails and Langgraph services.

**Decision:** JWT tokens, 24-hour expiry, httpOnly cookies.

**Why:** Stateless, simple, no shared session store needed.

**Trade-offs:** Can't revoke individual tokens without blocklist.

**Status:** Superseded by "Extend JWT expiry to 7 days" (2025-12-28)

---

### 2025-09-01: Choose JWT over sessions

**Context:** Rails and Langgraph are separate services. Need shared auth.

**Decision:** Use JWT instead of sessions.

**Why:**
- No shared Redis needed
- Stateless validation
- Simpler than OAuth for internal services

**Alternatives considered:**
- Shared sessions (requires Redis, cookie domain complexity)
- API keys (per-user key management overhead)
- OAuth (overkill for internal services)

**Status:** Current (approach unchanged, expiry modified)

---
```

## Why This Pattern

1. **No contradictions** - Can't have two files saying different things about auth
2. **History preserved** - Know what we decided before and why we changed
3. **Easy to update** - Add to top, update status of old
4. **Searchable** - `grep "authentication" docs/decisions/` finds everything
5. **Context for agents** - Agent reads one file, gets full picture including evolution

## Quality Check

Good decision logs:
- Most recent at top
- Previous decisions marked as superseded (not deleted)
- "Current State" section always reflects reality
- Clear reasoning for changes, not just the change itself
