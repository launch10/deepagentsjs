# Help Center

The help center has two components: an **AI support agent** that answers questions using FAQ search, and a **ticket system** for issues the agent can't resolve. The support agent runs as a single-node Langgraph graph. Tickets create Slack notifications and Notion records.

## AI Support Agent

```
POST /api/support/stream { threadId, messages }
       │
       ▼
supportGraph
  START → supportAgent → END
```

The agent has one tool: `supportFaqTool` (searches the knowledge base). It encourages parallel FAQ queries for multi-topic questions. If no FAQ matches, it directs users to submit a support ticket.

**LLM config**: `speed: "fast"` tier with prompt caching.

## Ticket System

```
User submits support form
       │
       ▼
POST /support { subject, description, category, attachments }
       │
       ├─ SupportMailer → email to user with ticket reference
       ├─ Support::SlackNotificationWorker → team notification
       └─ Support::NotionCreationWorker → ticket in Notion
```

**Categories**: "Report a bug", "Billing question", "How do I...?", "Feature request", "Other"

**Rate limit**: Max 5 tickets per hour per user.

**Attachments**: Up to 3 files, max 10MB each, images and PDFs only.

**Ticket ID format**: `SR-XXXXXXXX` (e.g., `SR-1a2b3c4d`)

## Key Files Index

| File | Purpose |
|------|---------|
| `langgraph_app/app/graphs/support.ts` | Support graph (single-node) |
| `langgraph_app/app/nodes/support/agent.ts` | Agent with FAQ tool |
| `rails_app/app/models/support_request.rb` | Ticket model (categories, rate limit) |
| `rails_app/app/controllers/support_controller.rb` | Form + ticket creation |
| `rails_app/app/workers/support/slack_notification_worker.rb` | Slack alert |
| `rails_app/app/workers/support/notion_creation_worker.rb` | Notion ticket creation |

## Gotchas

- **Account-level chat**: Support chats have no project — they're account-scoped with `chat_type: "support"`.
- **FAQ tool only**: The agent has no access to user data or account details. It can only search the knowledge base.
- **Credit-tracked**: Support conversations consume credits like any other graph, tracked via `withCreditExhaustion` wrapper.
