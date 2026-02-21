# Next Steps

## Top Priority

### 1. AI Cost Reconciliation System
**Plan**: Needs to be written
**Status**: Not started
**Why**: No verification that our billing pipeline works correctly. Silent bugs = lost revenue.
**Start with**: Phase 1 (Internal Self-Audit + Account Audit) — no external dependencies, catches the most dangerous problems immediately.

---

## Important (Needs Planning)

### 2. Agent Memory System
**Plan**: Needs to be written
**Status**: Concept stage
**Why**: Agents need persistent, self-managed memory to understand project context across conversations. Currently Brainstorm is a hardcoded version of this pattern — a proper memory system generalizes it.

**Core idea**: A markdown-like file system (stored in DB) where:
- Agents can read/write to project-scoped and user-scoped memories
- Core lifecycle hooks prompt the agent to reflect on whether memories should be created or consolidated
- Replaces ad-hoc context patterns (Brainstorm fields, scattered state) with a unified memory layer

**Builds on**: The existing Context Engineering system (AgentContextEvent, event subscriptions, turn preparation) provides the event backbone. Memory adds the agent's own persistent understanding on top.
