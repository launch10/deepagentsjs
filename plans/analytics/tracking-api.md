## Analytics API (Page Views & Events)

### Why Build Our Own Analytics

1. **Our product IS the analytics** – Users need to see which headline/campaign won; that requires joining page views → leads → campaigns in one database.

2. **Google tracks page views, but the data lives in Google** – To show "Headline A: 500 views, 12 signups" we need page views and leads in the same place, not split across vendors.

3. **PostHog gets expensive fast** – $0.00045/event means a busy landing page costs us $100+/month per user site.

4. **It's not much work** – Ahoy gives us battle-tested schema; we just need one API endpoint and ~50 lines in tracking.ts.

5. **We can add PostHog later** – If users want heatmaps or session replay, that's a premium add-on, not our analytics backbone.

### Implementation Plan

We use Ahoy's backend (models, migrations, query helpers) but cherry-pick client-side tracking into our existing `tracking.ts`.

### Always

Use TDD (red/green/refactor).

#### Phase 1: Install Ahoy

```bash
bundle add ahoy_matey
rails generate ahoy:install
rails db:migrate
```

This creates:

- `ahoy_visits` table (visitor_token, visit_token, UTMs, referrer, landing_page, etc.)
- `ahoy_events` table (visit_id, name, properties, time)
- `Ahoy::Visit` and `Ahoy::Event` models

#### Phase 2: Add API Endpoint

Create a tracking endpoint that static sites can POST to:

```ruby
# app/controllers/api/v1/tracking_controller.rb
module Api
  module V1
    class TrackingController < ApplicationController
      skip_before_action :verify_authenticity_token

      def visit
        # Find or create visit from visitor_token + visit_token
        # Store UTMs, gclid, referrer, user_agent, etc.
      end

      def event
        # Create Ahoy::Event linked to visit
        # name: "page_view", "form_start", "form_submit", etc.
        # properties: { path: "/", variant: "A", ... }
      end
    end
  end
end
```

#### Leads API Should Create Ahoy Conversion Event

Update existing leads API to accept gclid and create Ahoy conversion event, in additional to tracking lead.

#### Phase 3: Update tracking.ts

Cherry-pick ~50 lines from ahoy.js into tracking.ts:

```typescript
// Add to tracking.ts
const L10 = {
  // Existing createLead method...

  // New tracking methods:
  getVisitorToken(): string {
    let token = localStorage.getItem("ahoy_visitor");
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem("ahoy_visitor", token);
    }
    return token;
  },

  getVisitToken(): string {
    let token = sessionStorage.getItem("ahoy_visit");
    if (!token) {
      token = crypto.randomUUID();
      sessionStorage.setItem("ahoy_visit", token);
    }
    return token;
  },

  async trackVisit(): Promise<void> {
    await fetch(`${apiBaseUrl}/api/v1/tracking/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitor_token: this.getVisitorToken(),
        visit_token: this.getVisitToken(),
        referrer: document.referrer,
        landing_page: window.location.href,
        // UTMs parsed from URL
        utm_source: getParam("utm_source"),
        utm_medium: getParam("utm_medium"),
        utm_campaign: getParam("utm_campaign"),
        utm_content: getParam("utm_content"), // Key for A/B testing
        utm_term: getParam("utm_term"),
        gclid: getGclid(),
      }),
    });
  },

  async trackEvent(name: string, properties?: Record<string, any>): Promise<void> {
    await fetch(`${apiBaseUrl}/api/v1/tracking/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitor_token: this.getVisitorToken(),
        visit_token: this.getVisitToken(),
        name,
        properties,
        time: new Date().toISOString(),
      }),
    });
  },
};

// Auto-track page view on load
if (typeof window !== "undefined") {
  L10.trackVisit();
  L10.trackEvent("page_view", { path: window.location.pathname });
}
```

#### Phase 4: Build Integration

Update `buildable.rb` to inject website_token for multi-tenant tracking:

```ruby
def write_env_file!
  env_vars = {
    "VITE_SIGNUP_TOKEN" => website.project.signup_token,
    "VITE_API_BASE_URL" => Rails.configuration.x.api_base_url,
    "VITE_GOOGLE_ADS_SEND_TO" => google_send_to,
    "VITE_WEBSITE_TOKEN" => website.tracking_token  # New: identifies which website
  }
  File.write(File.join(temp_dir, ".env"), env_vars.compact.map { |k, v| "#{k}=#{v}" }.join("\n"))
end
```

### Data Model

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Ahoy::Visit   │──────▶│   Ahoy::Event   │       │      Lead       │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ visitor_token   │       │ visit_id        │       │ email           │
│ visit_token     │       │ name            │       │ gclid           │
│ utm_source      │       │ properties      │       │ visit_id (new)  │
│ utm_medium      │       │ time            │       │ project_id      │
│ utm_campaign    │       └─────────────────┘       └─────────────────┘
│ utm_content     │                │
│ utm_term        │                │
│ gclid           │                ▼
│ referrer        │       Events: page_view, form_start, form_submit, scroll_50, etc.
│ landing_page    │
│ website_id (new)│
└─────────────────┘
```

### Key Queries Enabled

```ruby
# Funnel by utm_content (A/B test variant)
Visit.where(website: website)
     .group(:utm_content)
     .select("utm_content, COUNT(*) as visits,
              COUNT(DISTINCT leads.id) as conversions")
     .joins("LEFT JOIN leads ON leads.visit_id = ahoy_visits.id")

# Campaign performance
Visit.where(website: website)
     .where.not(utm_campaign: nil)
     .group(:utm_campaign)
     .count

# gclid attribution (which Google Ads clicks converted)
Lead.joins(:visit)
    .where.not("ahoy_visits.gclid": nil)
    .group("ahoy_visits.gclid")
    .count
```

### ClickUp Task

[Analytics API Implementation](https://app.clickup.com/t/86b84wbwa)
