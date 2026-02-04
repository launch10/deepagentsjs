# Support Page - Planning Document

**Branch**: `support-page`
**Author**: Claude Code
**Date**: January 30, 2026

---

## Feature Overview

A standalone support page at `/support` that allows authenticated users to submit support requests. Each submission persists in the database and triggers three async integrations: email to `support@launch10.ai`, Slack notification, and Notion database entry.

## Architecture Decisions

### 1. Persisted Model (SupportRequest)

We chose to persist support requests in our database rather than fire-and-forget to external services. This provides:
- Ticket reference numbers (e.g., `SR-000042`)
- Audit trail of all requests
- Retry safety — if Slack/Notion fails, the data isn't lost
- Future ability to build an admin view of support requests

### 2. Async Processing via Sidekiq Workers

All three integrations run asynchronously after form submission:
- **Email**: `SupportMailer.deliver_later` (ActionMailer built-in)
- **Slack**: `Support::SlackNotificationWorker` (Sidekiq, 3 retries)
- **Notion**: `Support::NotionCreationWorker` (Sidekiq, 3 retries)

The user gets instant redirect with success toast. Each worker independently retries on failure and updates a status flag (`slack_notified`, `notion_created`, `email_sent`) on the `SupportRequest` record.

### 3. Active Storage for Attachments

We use Rails Active Storage (`has_many_attached :attachments`) instead of the existing CarrierWave/S3 Upload model. Rationale:
- Support attachments are simple: attach to an email, no persistent file management
- No need for the full Upload model's website association or S3 bucket organization
- Active Storage is built into Rails 8 and simpler for this use case

### 4. Authenticated-Only

The support page requires authentication (inherits `SubscribedController`). This lets us auto-capture user context (ID, email, subscription tier, credits) without asking the user to enter it.

---

## Files Created

| File | Purpose |
|------|---------|
| `db/migrate/20260130204037_create_support_requests.rb` | Database table |
| `app/models/support_request.rb` | Model with validations, Active Storage |
| `app/controllers/support_controller.rb` | Show + create actions |
| `app/mailers/support_mailer.rb` | Email mailer |
| `app/views/support_mailer/support_request.html.erb` | HTML email template |
| `app/views/support_mailer/support_request.text.erb` | Plain text email template |
| `app/workers/support/slack_notification_worker.rb` | Slack webhook POST |
| `app/workers/support/notion_creation_worker.rb` | Notion API page creation |
| `app/javascript/frontend/pages/Support.tsx` | React page with form + success state |
| `spec/factories/support_requests.rb` | FactoryBot factory |
| `spec/models/support_request_spec.rb` | Model validations |
| `spec/requests/inertia/support_spec.rb` | Controller request specs |
| `spec/workers/support/slack_notification_worker_spec.rb` | Slack worker specs |
| `spec/workers/support/notion_creation_worker_spec.rb` | Notion worker specs |
| `spec/mailers/support_mailer_spec.rb` | Mailer specs |

## Files Modified

| File | Change |
|------|--------|
| `config/routes/subscribed.rb` | Added `resource :support` route |
| `app/models/account.rb` | Added `has_many :support_requests` |
| `app/javascript/frontend/components/navigation/AppSidebar.tsx` | Added Support link with QuestionMarkCircleIcon |
| `.env` / `.env.example` | Added `SUPPORT_SLACK_WEBHOOK_URL`, `SUPPORT_NOTION_SECRET`, `SUPPORT_NOTION_DATABASE_ID` |

---

## Form Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Category | Select | Yes | One of: "Report a bug", "Billing question", "How do I...?", "Feature request", "Other" |
| Subject | Text | Yes | 5-200 characters |
| Description | Textarea | Yes | 20-5000 characters |
| Attachments | File | No | Max 3 files, 10MB each, images/PDFs only |

Auto-captured (hidden): user ID, email, subscription tier, credits remaining, source URL, browser info.

## Submission Flow

```
User submits form
  → POST /support
    → SupportRequest saved to DB
    → SupportMailer.deliver_later (email to support@launch10.ai)
    → Support::SlackNotificationWorker.perform_async (Slack webhook)
    → Support::NotionCreationWorker.perform_async (Notion API)
    → Redirect to /support with success flash
  → User sees confirmation with ticket reference
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `SUPPORT_SLACK_WEBHOOK_URL` | Slack incoming webhook for support channel |
| `SUPPORT_NOTION_SECRET` | Notion integration API token |
| `SUPPORT_NOTION_DATABASE_ID` | Notion database to create entries in |

## Notion Database Schema

The Notion database should have these properties:
- **Title** (title) — Support request subject
- **Category** (select) — Bug, Billing, How-to, Feature Request, Other
- **Status** (select) — New, In Progress, Resolved, Closed
- **Email** (email) — User's email
- **Ticket Ref** (rich text) — SR-XXXXXX reference
- **Tier** (rich text) — Subscription tier

## Testing

- Model specs: validations, associations, ticket_reference
- Request specs: authenticated access, form submission, enqueued jobs/mail
- Worker specs: HTTP stub assertions, status flag updates, error handling
- Mailer specs: recipients, subject, body content

## Review Checklist

- [ ] Migration creates correct columns and foreign keys
- [ ] Model validations match form field requirements
- [ ] Controller auto-captures context fields correctly
- [ ] Email includes all relevant details and attachments
- [ ] Slack message is well-formatted with Block Kit
- [ ] Notion entry has correct property mapping
- [ ] React page matches existing app styling patterns
- [ ] Success state shows ticket reference
- [ ] Sidebar link appears in correct position with active state
- [ ] Tests cover happy path and edge cases
- [ ] Environment variables documented and added to .env.example
- [ ] No secrets committed to source control (webhook URL and Notion key are in .env, not code)
