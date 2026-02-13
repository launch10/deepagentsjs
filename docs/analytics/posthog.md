# PostHog Product Analytics

Product analytics for the Launch10 app itself (not end-user sites — that's Ahoy, see [tracking.md](tracking.md)). Every event dual-writes to PostHog and a local `app_events` table via ActiveSupport::Notifications.

## Architecture

```
Server-side:
  TrackEvent.call("event_name", user:, account:, project:, ...)
       │
       ▼
  ActiveSupport::Notifications.instrument("app_event.event_name", payload)
       │
       ▼
  PosthogSubscriber (subscribed to /app_event\..*/)
       ├── write_posthog → PosthogTracker.capture → PosthogTrackWorker (async Sidekiq)
       └── write_app_event → AppEvent.create!

Client-side:
  analytics.track("event_name", { ... })
       │
       ▼
  posthog.capture("event_name", properties)
```

Server events go through `TrackEvent.call` which instruments an ActiveSupport notification. The `PosthogSubscriber` listens for all `app_event.*` notifications and dual-writes: async to PostHog via Sidekiq, and synchronously to the `app_events` table.

Client events go directly to PostHog via `posthog-js`. These are only used for interactions that have no server-side equivalent (chat sends, previews, edits).

## Adding a New Event

### Server-side

```ruby
TrackEvent.call("my_event",
  user: current_user,          # required for PostHog (distinct_id)
  account: account,            # optional FK → app_events.account_id
  project: project,            # optional FK → app_events.project_id
  campaign: campaign,          # optional FK → app_events.campaign_id
  website: website,            # optional FK → app_events.website_id
  any_property: "value"        # everything else becomes PostHog properties + app_events.properties jsonb
)
```

The subscriber extracts `user`, `account`, `project`, `campaign`, `website` from the payload as FK references. Everything else is passed as properties to both PostHog and the `app_events.properties` jsonb column.

### Client-side

```typescript
import { analytics } from "@lib/analytics";

// Generic event
analytics.track("my_event", { key: "value" });

// Project-scoped event (auto-adds project_uuid)
analytics.trackProject("my_event", project.uuid, { key: "value" });
```

Client-side tracking gracefully no-ops when PostHog isn't loaded (dev without env vars).

## Event Inventory

### Acquisition

Users sign up

| Event            | Side   | Location                                                            | Key Properties                                                 |
| ---------------- | ------ | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| `user_signed_up` | Server | `user.rb` after_create_commit                                       | `method`, `referral_code`                                      |
| `user_signed_in` | Server | `sessions_controller.rb` (email/OTP), `warden_callbacks.rb` (OAuth) | `method`, `days_since_signup`, `has_projects`, `project_count` |
| Page views       | Client | Auto-captured by posthog-js (`capture_pageview: true`)              | URL, referrer, UTMs                                            |

### Activation

Users use our product

| Event                  | Side   | Location                                                | Key Properties                                                                |
| ---------------------- | ------ | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `subscription_started` | Server | `pay_subscription_credits.rb`                           | `plan_name`, `plan_interval`, `plan_amount_cents`, `time_since_signup_hours`  |
| `project_created`      | Server | `project.rb` after_commit                               | `project_uuid`, `project_number`, `time_since_signup_hours`                   |
| `brainstorm_started`   | Server | `brainstorm.rb` after_create_commit                     | `project_uuid`, `is_first_brainstorm`                                         |
| `brainstorm_completed` | Server | `brainstorm.rb` after_update_commit (when `complete?`)  | `project_uuid`, `duration_minutes`                                            |
| `chat_message_sent`    | Client | `SubmitButton.tsx`                                      | `chat_type`, `project_uuid`, `message_length`                                 |
| `website_generated`    | Server | `website_files_controller.rb` write action              | `project_uuid`, `file_count`                                                  |
| `website_previewed`    | Client | `WebsitePreview.tsx` (on WebContainer load)             | `project_uuid`                                                                |
| `domain_configured`    | Server | `domains_controller.rb` create action                   | `project_uuid`, `domain_type`, `domain_name`                                  |
| `website_deployed`     | Server | `deployable.rb` `actually_deploy` (success + failure)   | `project_uuid`, `deploy_status`, `is_first_deploy`, `deploy_duration_seconds` |
| `website_rollback`     | Server | `deployable.rb` `actually_rollback`                     | `project_uuid`, `rollback_to_version`                                         |

### Retention

Users continue to use our product

| Event                        | Side   | Location                                                                     | Key Properties                                                       |
| ---------------------------- | ------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `workflow_step_reached`      | Server | `project_workflow.rb` (`next_step!` and `advance_to`)                        | `project_uuid`, `step`, `substep`, `previous_step`                   |
| `campaign_stage_completed`   | Server | `campaign_concerns/stages.rb` `advance_stage!`                               | `project_uuid`, `stage`                                              |
| `campaign_deployed`          | Server | `campaign_deploy.rb` (success) + `deploy_worker.rb` (failure after retries)  | `project_uuid`, `deploy_status`, `failed_step`, `daily_budget_cents` |
| `campaign_status_changed`    | Server | `campaign.rb` after_save                                                     | `project_uuid`, `old_status`, `new_status`, `days_active`            |
| `project_status_changed`     | Server | `project.rb` after_update_commit                                             | `project_uuid`, `old_status`, `new_status`                           |
| `dashboard_viewed`           | Server | `dashboard_controller.rb`                                                    | `project_count`, `live_project_count`, `has_insights`                |
| `insights_viewed`            | Server | `dashboard_insights_controller.rb`                                           | `insight_count`, `triggered_regeneration`                            |
| `project_performance_viewed` | Server | `projects_controller.rb`                                                     | `project_uuid`, `has_leads`, `has_traffic`                           |
| `website_edited`             | Client | `BuildStep.tsx`, `WebsitePreview.tsx`, `WebsiteChat.tsx`, `QuickActions.tsx` | `project_uuid`, `edit_type` (chat_iteration/error_fix/theme_change)  |
| `lead_received`              | Server | `leads/process_worker.rb`                                                    | `project_uuid`, `has_gclid`, `total_leads_for_project`               |

### Revenue

Users pay for our product

| Event                       | Side   | Location                                  | Key Properties                                                                    |
| --------------------------- | ------ | ----------------------------------------- | --------------------------------------------------------------------------------- |
| `subscription_renewed`      | Server | `credits/renewal_handler.rb`              | `plan_name`, `plan_amount_cents`, `months_subscribed`, `credits_used_this_period` |
| `subscription_plan_changed` | Server | `credits/plan_change_handler.rb`          | `old_plan`, `new_plan`, `direction`, `months_on_old_plan`                         |
| `subscription_cancelled`    | Server | `credits/cancellation_handler.rb`         | `plan_name`, `months_subscribed`, `projects_live`, `last_active_days_ago`         |
| `credit_pack_purchased`     | Server | `credits/allocate_pack_credits_worker.rb` | `pack_credits`, `pack_price_cents`, `current_balance`, `plan_name`                |

### Referral

Users invite others to try our product

| Event                       | Side   | Location                      | Key Properties                                          |
| --------------------------- | ------ | ----------------------------- | ------------------------------------------------------- |
| `referral_code_viewed`      | Server | `referrals_controller.rb`     | `referral_code`                                         |
| `referral_signup_completed` | Server | `registrations_controller.rb` | `referrer_user_id`, `referral_code`, `referred_user_id` |

### Not Yet Implemented

| Event                  | Reason                                   |
| ---------------------- | ---------------------------------------- |
| `pricing_page_viewed`  | No dedicated Inertia pricing page exists |
| `referral_link_shared` | Referral share UI doesn't exist yet      |

## app_events Table

Every server-side event is persisted to `app_events` with optional FK columns for querying without PostHog:

```
app_events
  id              bigint PK
  event_name      string NOT NULL (indexed)
  user_id         bigint (optional, indexed, no FK)
  account_id      bigint (optional, indexed, no FK)
  project_id      bigint (optional, indexed, no FK)
  campaign_id     bigint (optional, indexed, no FK)
  website_id      bigint (optional, indexed, no FK)
  properties      jsonb
  created_at      datetime (indexed)
```

Query examples:

```ruby
# All events for an account
AppEvent.where(account_id: account.id).order(created_at: :desc)

# Funnel: signup → project → deploy for a user
AppEvent.where(user_id: user.id, event_name: %w[user_signed_up project_created website_deployed])

# Recent deploys
AppEvent.where(event_name: "website_deployed").where("created_at > ?", 24.hours.ago)
```

## User Identification

**Server-side**: `PosthogTracker.capture(user, event, props)` uses `user.id` as the PostHog `distinct_id`.

**Client-side**: `site-layout.tsx` calls `analytics.identify(user.id, { email, name })` when the user is logged in, and `analytics.reset()` on logout.

## Environment Variables

| Variable               | Where                                     | Purpose                          |
| ---------------------- | ----------------------------------------- | -------------------------------- |
| `POSTHOG_API_KEY`      | Rails credentials or ENV                  | Server-side PostHog API key      |
| `POSTHOG_HOST`         | ENV (default: `https://us.i.posthog.com`) | PostHog instance URL             |
| `VITE_POSTHOG_API_KEY` | `.env`                                    | Client-side PostHog API key      |
| `VITE_POSTHOG_HOST`    | `.env` (optional)                         | Client-side PostHog host         |
| `VITE_POSTHOG_ENABLED` | `.env` (optional)                         | Set to `"true"` to enable in dev |

PostHog is disabled when no API key is configured. The `POSTHOG` constant is `nil` and all tracking no-ops.

## Key Files

| File                                              | Purpose                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `app/lib/track_event.rb`                          | `TrackEvent.call` — single entry point for server events         |
| `app/subscribers/posthog_subscriber.rb`           | Subscribes to notifications, dual-writes to PostHog + app_events |
| `app/lib/posthog_tracker.rb`                      | Thin wrapper, delegates to async Sidekiq worker                  |
| `app/workers/posthog_track_worker.rb`             | Async PostHog delivery via Sidekiq                               |
| `app/models/app_event.rb`                         | Local event store model                                          |
| `config/initializers/posthog.rb`                  | PostHog Ruby client initialization                               |
| `config/initializers/app_events.rb`               | Wires up PosthogSubscriber on boot                               |
| `app/javascript/frontend/lib/analytics.ts`        | Client-side `analytics.track()` / `analytics.trackProject()`     |
| `app/javascript/entrypoints/inertia.ts`           | PostHog client initialization (`initPostHog()`)                  |
| `app/javascript/frontend/layouts/site-layout.tsx` | User identification on page load                                 |

## Gotchas

- **Ahoy is NOT PostHog**: Ahoy tracks visitors on deployed landing pages (end-user sites). PostHog tracks Launch10 app usage (our product). They are completely separate systems.
- **Server-side preferred**: Prefer server-side events over client-side. They can't be blocked by ad blockers and they dual-write to `app_events`. Only use client-side for interactions with no server roundtrip (chat sends, previews, in-browser edits).
- **Async delivery**: PostHog events are sent via Sidekiq (`PosthogTrackWorker`) to avoid blocking request threads. Events may be delayed by queue depth.
- **No PostHog in dev by default**: The `POSTHOG` constant is `nil` without an API key. `PosthogTrackWorker` and `PosthogTracker` both guard against this. `app_events` records are still created.
- **Duplicate prevention**: Each event should fire from exactly one location. When both server and client could track the same event, choose server-side and remove the client-side call.
