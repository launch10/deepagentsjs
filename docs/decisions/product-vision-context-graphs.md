# Product Vision: Context Graphs and Organizational Learning

## The Problem Launch10 Solves

Users need to validate business ideas quickly. This means:
1. Brainstorming compelling marketing copy
2. Creating landing pages that convert
3. Running ads to drive traffic
4. Analyzing results to learn what works

But the deeper problem is: **how do we learn what actually works?**

## The Vision: Context Graphs

Launch10 isn't just a landing page builder. It's building toward a **context graph** - infrastructure that captures decision traces, not just data.

### The Two Clocks Problem

Every system has:
- **State clock**: What's true right now (database records)
- **Event clock**: What happened, in what order, with what reasoning

We've built trillion-dollar infrastructure for state. The event clock barely exists. The reasoning that connects observations to actions was never treated as data - it lived in heads, Slack threads, unrecorded meetings.

### How Launch10 Captures Decision Traces

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
    Landing Page
         │
         ▼
    Ad Campaign
         │
         ▼
┌─────────────────────────────────────────┐
│  Analytics Feedback Loop (Future)       │
│  - Which pages converted?               │
│  - Which copy resonated?                │
│  - What patterns emerge across users?   │
└─────────────────────────────────────────┘
         │
         ▼
    Improved AI Recommendations
```

### Agents as Informed Walkers

The key insight: agents traversing problems discover structure through use.

When a user brainstorms with Launch10:
- The agent explores their business idea
- It touches on audience, value proposition, pain points
- This trajectory is a walk through "business validation state space"

Accumulate thousands of these trajectories and you get a learned representation of what makes ideas succeed or fail.

### The Long-Term Goal

**Learn what converts.**

Not just for one user, but across all users. The context graph becomes a world model for "business validation physics":
- Which value propositions resonate with which audiences?
- What copy patterns lead to higher conversion?
- How do successful pages differ from unsuccessful ones?

This isn't retrieval ("find me similar pages"). It's inference ("given this business idea, what's likely to convert?").

## Current Implementation Status

| Component | Status |
|-----------|--------|
| Brainstorm agent | Live (captures thread history) |
| Website builder | In development (branch) |
| Ads builder | Live |
| Analytics feedback loop | Future |
| Cross-user learning | Future |

## Why This Matters for Architecture

### Thread History is Critical

Langgraph threads preserve the full conversation - every user input, every AI response, every decision point. This is the raw material for the context graph.

**Don't lose thread history.** It's not just for debugging; it's training data.

### Structured Outputs Enable Learning

The brainstorm agent uses structured prompts (audience, value prop, pain points, solution) because:
1. Users get better marketing copy (immediate value)
2. We get structured data for learning (future value)

Good structure now = better learning later.

### Quality Metrics

A "good" brainstorm output has:
- Clear marketing copy fundamentals (value prop, audience, problem/solution)
- Conversion potential (will it actually get clicks/signups?)

This is measurable through the analytics loop - eventually we can correlate brainstorm patterns with conversion outcomes.

## References

- Langgraph thread implementation: `langgraph_app/app/graphs/`
- Brainstorm prompts: `langgraph_app/app/prompts/brainstorm/`
- The "Two Clocks" concept from PlayerZero's context graph research
