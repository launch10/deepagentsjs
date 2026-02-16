# Chat System

The Chat model is the link between Rails and Langgraph. Each chat has a `thread_id` that maps to a Langgraph conversation thread. Chats are polymorphic — they can belong to a Brainstorm, Website, Campaign, Deploy, or account-level feature (Insights, Support). Conversation history lives in Langgraph checkpoints; Rails only stores the routing metadata.

## Architecture

```
Rails                          Langgraph
┌──────────────────┐          ┌──────────────────┐
│ Chat              │          │ Thread            │
│  thread_id ───────│──────────│→ checkpoints     │
│  chat_type        │          │  (conversation    │
│  contextable_type │          │   state history)  │
│  contextable_id   │          │                   │
│  project_id       │          │                   │
│  account_id       │          │                   │
└──────────────────┘          └──────────────────┘
```

## Chat Types

| Type | Scope | Contextable | Example |
|------|-------|-------------|---------|
| brainstorm | Project | Brainstorm | Idea capture conversation |
| website | Project | Website | Website editing conversation |
| ads | Project | Campaign | Ad creation conversation |
| deploy | Project | Deploy | Deployment conversation |
| insights | Account | — | Dashboard insights |
| support | Account | — | Help center chat |

## How Chats Are Created

Chats are created via the `ChatCreatable` concern mixed into models that need conversations:

```ruby
# In Brainstorm, Website, Campaign, Deploy:
include ChatCreatable

# Creates a Chat with:
# - thread_id: SecureRandom.uuid (or provided)
# - chat_type: derived from model class
# - contextable: self
# - project_id: from association chain
# - account_id: from Current.account
```

## Thread Validation

When Langgraph receives a request with a `threadId`:

1. Middleware calls Rails `GET /api/v1/chats/validate?thread_id=<id>`
2. Rails checks: chat exists? belongs to requesting account?
3. Returns 403 if validation fails
4. Langgraph only proceeds on success

This ensures cross-account chat access is impossible.

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/models/chat.rb` | Chat model (polymorphic, tenant-scoped) |
| `rails_app/app/models/concerns/chat_creatable.rb` | Mixin for auto-creating chats |
| `rails_app/app/controllers/api/v1/chats_controller.rb` | Thread validation endpoint |
| `langgraph_app/app/server/middleware/threadValidation.ts` | Thread ownership verification |

## Gotchas

- **Rails stores routing, not history**: Conversation messages live in Langgraph's PostgreSQL checkpointer, not in the Rails `chats` table. The Chat model is a pointer, not a store.
- **`acts_as_tenant :account`**: All chat queries are automatically scoped to the current account. Use `Chat.unscoped` only in the validation endpoint (which checks across accounts intentionally).
- **`acts_as_paranoid`**: Chats are soft-deleted. A deleted chat's thread_id is still valid in Langgraph but won't be returned by Rails queries.
- **One chat per contextable type per project**: A project has at most one brainstorm chat, one website chat, etc. The chat type determines which graph handles the conversation.
