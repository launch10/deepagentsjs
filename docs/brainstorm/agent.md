# Brainstorm Agent

The brainstorm agent guides users through capturing four elements of their business idea: **idea**, **audience**, **solution**, and **social proof**. It runs as a single-agent graph with topic tracking, mode switching, and memory persistence. The agent uses three tools: `saveAnswersTool` (persist responses), `finishedTool` (mark brainstorm complete), and `queryUploadsTool` (search uploaded documents).

## Flow

```
POST /api/brainstorm/stream { threadId, messages }
       │
       ▼
brainstormGraph
  START → createBrainstorm → handleCommand → brainstormAgent → compactConversation → END
```

1. **createBrainstorm**: On first message, links to Rails-created Brainstorm record
2. **handleCommand**: Detects mode switches (helpMe, doTheRest, finishSkipped)
3. **brainstormAgent**: AI conversation loop with tools
4. **compactConversation**: Compress history to stay within context limits

## Brainstorm Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| `default` | Normal conversation | Ask questions one at a time |
| `helpMe` | User asks for help | Provide examples and suggestions |
| `doTheRest` | User says "finish it" | Auto-complete remaining topics |
| `uiGuidance` | UI-driven input | Process structured form data |
| `finishSkipped` | Revisit skipped topics | Ask about previously skipped items |

## Data Model

```ruby
Brainstorm
  ├─ idea          # Business idea description
  ├─ audience      # Target audience
  ├─ solution      # How the product solves the problem
  ├─ social_proof  # Testimonials, stats, credentials
  ├─ look_and_feel # Visual style preferences
  │
  ├─ belongs_to :website
  ├─ has_one :chat (via ChatCreatable)
  └─ belongs_to :project
```

## Creation Flow

1. Frontend creates brainstorm via `POST /api/v1/brainstorms` with `thread_id` and `project_uuid`
2. Rails creates: Project → ProjectWorkflow → Website → Brainstorm → Chat
3. First message to Langgraph triggers `createBrainstorm` node which links state to the Rails records

## Key Files Index

| File | Purpose |
|------|---------|
| `langgraph_app/app/graphs/brainstorm.ts` | Brainstorm graph definition |
| `langgraph_app/app/nodes/brainstorm/agent.ts` | Agent node with tools |
| `langgraph_app/app/annotation/brainstormAnnotation.ts` | Graph state (topics, modes, memories) |
| `rails_app/app/models/brainstorm.rb` | Brainstorm model (idea, audience, solution, social_proof) |
| `rails_app/app/models/concerns/brainstorm_concerns/creation.rb` | Full creation chain |
| `rails_app/app/controllers/api/v1/brainstorms_controller.rb` | CRUD API |

## Gotchas

- **Topic tracking**: The agent tracks `currentTopic`, `remainingTopics`, and `skippedTopics` in graph state. Topics are processed in order but can be skipped and revisited.
- **Memory system**: Persistent memories track user preferences and topic history across conversation turns. This helps the agent maintain context during long sessions.
- **Prompt caching**: Uses `createPromptCachingMiddleware()` to cache the system prompt (~11K tokens) across turns.
- **Completeness validation**: Brainstorm is only considered complete when all four core fields (idea, audience, solution, social_proof) have been saved via `saveAnswersTool`.
