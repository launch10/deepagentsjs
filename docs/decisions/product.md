# Product: Decision History

> Decisions about product vision, features, and priorities. Most recent first.

---

## Current State

Launch10 helps users validate business ideas quickly through brainstorming → landing pages → ads → analytics. Early beta stage. Building toward a context graph that learns what converts.

| Component | Status |
|-----------|--------|
| Brainstorm agent | Live (captures thread history) |
| Website builder | In development (branch) |
| Ads builder | Live |
| Analytics feedback loop | Future |
| Cross-user learning | Future |

---

## Decision Log

### 2025-12-28: Build Toward Context Graphs

**Context:** Users need to validate business ideas quickly. But the deeper problem is: how do we learn what actually works?

**Decision:** Launch10 isn't just a landing page builder. It's building toward a **context graph** - infrastructure that captures decision traces, not just data.

**Why:**

The Two Clocks Problem:
- **State clock**: What's true right now (database records)
- **Event clock**: What happened, in what order, with what reasoning

We've built trillion-dollar infrastructure for state. The event clock barely exists. The reasoning that connects observations to actions was never treated as data.

How Launch10 captures decision traces:
```
User Brainstorm Session
         │
         ▼
┌─────────────────────────────────────────┐
│  Langgraph Thread History               │
│  - User inputs and preferences          │
│  - AI suggestions and refinements       │
│  - Final marketing copy decisions       │
│  - WHY certain approaches were chosen   │
└─────────────────────────────────────────┘
         │
         ▼
    Landing Page → Ad Campaign → Analytics Feedback Loop (Future)
         │
         ▼
    Improved AI Recommendations
```

Agents as informed walkers:
- When a user brainstorms, the agent explores their business idea
- It touches on audience, value proposition, pain points
- This trajectory is a walk through "business validation state space"
- Accumulate thousands of these and you learn what makes ideas succeed or fail

The long-term goal: **Learn what converts.**
- Which value propositions resonate with which audiences?
- What copy patterns lead to higher conversion?
- How do successful pages differ from unsuccessful ones?

This isn't retrieval ("find me similar pages"). It's inference ("given this business idea, what's likely to convert?").

**Architectural implications:**
- Thread history is critical - don't lose it, it's training data
- Structured outputs enable learning - good structure now = better learning later
- Quality metrics matter - "good" brainstorm has conversion potential

**Status:** Current (vision, being implemented incrementally)

---

## Files Involved

- `langgraph_app/app/graphs/` - Agent implementations
- `langgraph_app/app/prompts/brainstorm/` - Structured brainstorm prompts
- Langgraph thread storage - Preserves full conversation history
