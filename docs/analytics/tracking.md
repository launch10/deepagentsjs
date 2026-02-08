# Analytics Tracking

Launch10 tracks visitor activity on deployed landing pages using a client-side library (`L10`) that sends events to a Rails tracking API. Visits, events, and lead conversions are stored in Ahoy tables. During deployment, the coding agent automatically injects `L10.createLead()` calls into email capture forms.

## How It Works

```
Deployed landing page
       │
       │ Page load → L10.trackVisit()
       ▼
POST /api/v1/tracking/visit
  → creates/finds Ahoy::Visit (UTM, gclid, referrer)
  ← returns visit_token
       │
       │ User interaction → L10.trackEvent(name, props)
       ▼
POST /api/v1/tracking/event
  → enqueues Tracking::EventWorker (async)
       │
       │ Email submit → L10.createLead(email)
       ▼
POST /api/v1/leads
  → creates Lead + WebsiteLead
  → fires gtag conversion (if Google Ads configured)
```

## Client Library

Injected into every deployed landing page at `src/lib/tracking.ts`:

| Method | Purpose |
|--------|---------|
| `L10.trackVisit()` | Called on page load. Creates visit, returns visit_token |
| `L10.trackEvent(name, props)` | Track custom events (button clicks, scroll depth, etc.) |
| `L10.createLead(email, { value?, currency? })` | Submit lead + fire Google Ads conversion |

## Auto-Injection

The deploy pipeline's `AddingAnalytics` task uses the coding agent to automatically inject `L10.createLead()` into components with email capture. It detects:

- `type="email"` inputs
- `setEmail()` state handlers
- `<form>` elements
- `onSubmit`/`handleSubmit` handlers
- `useForm()` hooks

## Environment Variables (Deployed Sites)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Rails API URL for tracking endpoints |
| `VITE_SIGNUP_TOKEN` | Project-specific signed token for auth |
| `VITE_GOOGLE_ADS_SEND_TO` | Google Ads conversion ID (e.g., `AW-123456/label`) |

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/templates/default/src/lib/tracking.ts` | Client-side tracking library (L10 object) |
| `rails_app/app/controllers/api/v1/tracking_controller.rb` | Visit + event endpoints |
| `rails_app/app/models/lead.rb` | Lead model (email, account_id) |
| `rails_app/app/models/website_lead.rb` | Lead ↔ Website junction with attribution |
| `rails_app/config/initializers/ahoy.rb` | Ahoy config (server-side visits disabled) |
| `langgraph_app/app/nodes/deploy/analyticsNode.ts` | Auto-injection of tracking code |

## Gotchas

- **Server-side visits disabled**: `Ahoy.server_side_visits = false`. All tracking is client-initiated via the L10 library.
- **Signed project tokens**: The `VITE_SIGNUP_TOKEN` is a project-specific signed token that authenticates tracking requests without user JWT. This allows anonymous visitor tracking.
- **Async event processing**: Events are enqueued to Sidekiq via `Tracking::EventWorker` for non-blocking responses (202 Accepted).
- **Lead deduplication**: `Lead.find_or_create_for_signup()` deduplicates by email within an account.
