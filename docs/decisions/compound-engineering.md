# Compound Engineering at Launch10

## The Philosophy

Each unit of work should make subsequent work easier - not harder.

Traditional development accumulates technical debt. Every feature adds complexity. Every change increases maintenance burden.

Compound engineering inverts this. Each feature you build:
- Documents patterns for the next feature
- Creates reusable components that accelerate future work
- Establishes conventions that reduce decision fatigue
- Codifies knowledge that compounds across the team (and agents)

## How We Practice It

### 1. Document Decisions, Not Just Code

When you make an architectural decision, write it down in `docs/decisions/`:

```markdown
# Why We Chose X

## The Problem
What were we trying to solve?

## The Decision
What did we decide and why?

## Consequences
What trade-offs did we accept?
```

This captures the "event clock" - not just what's true now, but why it became true.

### 2. Use `/compound` After Solving Hard Problems

When you solve a problem that took investigation, run:

```
/compound-engineering:workflows:compound
```

This captures:
- What the problem was
- How you solved it
- How to recognize similar problems in the future

### 3. Create Skills for Repeated Workflows

When you find yourself explaining "how to do X" repeatedly, create a skill in `.claude/skills/`:

```markdown
# Skill Name

## When to Use
[Description of when this skill applies]

## Steps
1. First step
2. Second step
...
```

Skills are operational - they tell agents (and humans) exactly how to do something.

### 4. Keep READMEs Practical

READMEs should answer:
- What does this thing do?
- How do I use it?
- What are the gotchas?

Not:
- Exhaustive API documentation
- Historical context (put that in decisions/)
- Philosophical justification

## The Compound Effect

Over time:
- Agents have more context to make better decisions
- New team members onboard faster
- You spend less time explaining, more time building
- The codebase teaches itself

## Current Documentation Map

### Decisions (`docs/decisions/`)
- `langgraph-rails-split.md` - Service architecture
- `product-vision-context-graphs.md` - Where we're going
- `jwt-authentication.md` - Auth approach
- `webcontainers.md` - In-browser execution
- `inertia-react.md` - Frontend architecture
- `schema-ownership.md` - Who owns the database
- `database-snapshots.md` - Testing approach

### Skills (`rails_app/.claude/skills/`)
- `cloudflare-deploy.md` - Deploying to production
- `inertia-props-types.md` - Adding typed props

### Service READMEs
- `rails_app/app/services/atlas/README.md` - Atlas client
- `langgraph_app/app/services/editor/scenarios/README.md` - Error scenarios

## What Makes Good Documentation

**Good:**
- Explains "why" not just "what"
- Shows real commands/code examples
- Lives close to the code it describes
- Gets updated when code changes

**Bad:**
- YAML frontmatter and metadata schemas
- Manually maintained indexes
- Template ceremonies
- Stale documentation that lies

Keep it simple. Write markdown when you learn something. Delete it when it's wrong.
