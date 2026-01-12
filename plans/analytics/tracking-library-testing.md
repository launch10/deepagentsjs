# L10.tracking Library - Implementation Plan

## Executive Summary

The L10 tracking library enables conversion tracking for Launch10 landing pages. This plan documents the implementation steps and dependencies.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AdsAccount Creation Flow                            │
│                              (PREREQUISITE)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Create AdsAccount (google_customer_id set)                              │
│  2. Create ConversionAction via Google Ads API                              │
│  3. Query tag_snippets to get conversion_label                              │
│  4. Store conversion_action_resource_name + conversion_label on AdsAccount  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Website Deploy Flow                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. buildable.rb writes VITE_GOOGLE_ADS_SEND_TO to .env                     │
│  2. buildable.rb injects gtag.js script into index.html <head>              │
│  3. Vite builds with env vars baked in                                      │
│  4. tracking.ts has access to google_send_to value                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Lead Capture Flow                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. User lands on page (gclid captured from URL → sessionStorage)           │
│  2. User submits form                                                       │
│  3. L10.createLead() POSTs to Rails API (includes gclid)                    │
│  4. On success, fires gtag('event', 'conversion', { send_to: ... })         │
│  5. Lead record created with gclid for attribution                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisite: ConversionAction in AdsAccount Creation

**ClickUp:** This should be added to the existing AdsAccount creation flow.

When an AdsAccount is created and synced to Google Ads, we also create a ConversionAction:

### Storage (AdsAccount)

```ruby
# Already exists:
platform_setting :google, :customer_id

# Add:
platform_setting :google, :conversion_action_resource_name  # e.g., "customers/123/conversionActions/456"
platform_setting :google, :conversion_label                 # e.g., "abc123XYZ"

# Derived helpers:
def google_conversion_id
  "AW-#{google_customer_id}" if google_customer_id.present?
end

def google_send_to
  "#{google_conversion_id}/#{google_conversion_label}" if google_conversion_id.present? && google_conversion_label.present?
end
```

### Service: GoogleAds::Resources::ConversionAction

**File:** `rails_app/app/services/google_ads/resources/conversion_action.rb`

```ruby
def create_lead_form_conversion_action(client, customer_id)
  conversion_action = client.resource.conversion_action do |ca|
    ca.name = "Lead Form Submission"
    ca.type = :WEBPAGE
    ca.category = :SUBMIT_LEAD_FORM
    ca.status = :ENABLED
    ca.counting_type = :ONE_PER_CLICK
    ca.click_through_lookback_window_days = 30
    ca.view_through_lookback_window_days = 1

    ca.attribution_model_settings = client.resource.attribution_model_settings do |ams|
      ams.attribution_model = :GOOGLE_SEARCH_ATTRIBUTION_DATA_DRIVEN
    end

    ca.value_settings = client.resource.value_settings do |vs|
      vs.default_value = 0
      vs.default_currency_code = "USD"
      vs.always_use_default_value = false
    end
  end

  operation = client.operation.create_resource.conversion_action(conversion_action)
  response = client.service.conversion_action.mutate_conversion_actions(
    customer_id: customer_id,
    operations: [operation]
  )

  response.results.first.resource_name
end

def get_conversion_tag_info(client, customer_id, resource_name)
  query = <<~QUERY
    SELECT conversion_action.id, conversion_action.name, conversion_action.tag_snippets
    FROM conversion_action
    WHERE conversion_action.resource_name = '#{resource_name}'
  QUERY

  response = client.service.google_ads.search(customer_id: customer_id, query: query)
  row = response.first

  # Parse conversion_label from tag_snippets
  conversion_label = nil
  row.conversion_action.tag_snippets.each do |snippet|
    if snippet.type == :WEBPAGE && snippet.event_snippet
      match = snippet.event_snippet.match(/send_to['"]:\s*['"]AW-\d+\/([^'"]+)['"]/)
      conversion_label = match[1] if match
    end
  end

  conversion_label
end
```

---

## Step 1: Inject gtag.js Script (buildable.rb)

**File:** `rails_app/app/models/concerns/website_deploy_concerns/buildable.rb`

```ruby
def build!
  # ... existing code ...

  # After writing files, before build
  inject_gtag_script! if google_send_to.present?

  # ... rest of build ...
end

private

def inject_gtag_script!
  index_path = File.join(temp_dir, "index.html")
  content = File.read(index_path)

  # Use conversion_id (AW-xxx) for gtag config, full send_to for conversions
  gtag_script = <<~HTML
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=#{google_conversion_id}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '#{google_conversion_id}');
    </script>
  HTML

  content.sub!('</head>', "#{gtag_script}</head>")
  File.write(index_path, content)
end

def google_conversion_id
  ads_account&.google_conversion_id
end

def google_send_to
  ads_account&.google_send_to
end

def ads_account
  @ads_account ||= website.project.account.ads_accounts.find_by(platform: "google")
end
```

---

## Step 2: Write VITE_GOOGLE_ADS_SEND_TO (buildable.rb)

**Modify:** `write_env_file!` in buildable.rb

```ruby
def write_env_file!
  env_vars = {
    "VITE_SIGNUP_TOKEN" => website.project.signup_token,
    "VITE_API_BASE_URL" => Rails.configuration.x.api_base_url,
    "VITE_GOOGLE_ADS_SEND_TO" => google_send_to  # e.g., "AW-123456789/abc123XYZ"
  }
  File.write(File.join(temp_dir, ".env"), env_vars.compact.map { |k, v| "#{k}=#{v}" }.join("\n"))
end
```

---

## Step 3: Update tracking.ts

**File:** `rails_app/templates/default/src/lib/tracking.ts`

```typescript
/**
 * L10 Lead Capture & Conversion Tracking
 *
 * Config via environment variables (injected at build time):
 * - VITE_API_BASE_URL
 * - VITE_SIGNUP_TOKEN
 * - VITE_GOOGLE_ADS_SEND_TO (e.g., "AW-123456789/abc123XYZ")
 */

function getGclid(): string | null {
  if (typeof window === 'undefined') return null;

  const urlParams = new URLSearchParams(window.location.search);
  const gclid = urlParams.get('gclid');

  if (gclid) {
    sessionStorage.setItem('gclid', gclid);
    return gclid;
  }

  return sessionStorage.getItem('gclid');
}

export const L10 = {
  async createLead(
    email: string,
    options?: { value?: number; name?: string }
  ): Promise<void> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    const signupToken = import.meta.env.VITE_SIGNUP_TOKEN;
    const googleAdsSendTo = import.meta.env.VITE_GOOGLE_ADS_SEND_TO;

    if (!apiBaseUrl || !signupToken) {
      console.error("[L10] Missing VITE_API_BASE_URL or VITE_SIGNUP_TOKEN");
      throw new LeadError("Configuration error");
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: options?.name,
          token: signupToken,
          gclid: getGclid(),
        }),
      });

      if (response.ok) {
        // Fire Google Ads conversion on success
        if (typeof window !== 'undefined' && window.gtag && googleAdsSendTo) {
          window.gtag("event", "conversion", {
            send_to: googleAdsSendTo,
            value: options?.value ?? 0,
            currency: "USD",
          });
        }
        return;
      }

      const data = await response.json().catch(() => ({})) as { error?: string };
      throw new LeadError(data.error || "Signup failed");
    } catch (error) {
      if (error instanceof LeadError) throw error;
      throw new LeadError("Network error");
    }
  },
};
```

---

## Step 4: gclid Capture (Query Parameter Preservation ticket)

**ClickUp:** [Query Parameter Preservation for Attribution](https://app.clickup.com/t/86b7u0ce8)

This ticket already covers:
- Capture gclid from URL
- Store in sessionStorage
- Include with form submission
- Backend schema: `lead.gclid`

Tag this ticket with `mvp` if not already.

---

## Implementation Checklist

| Task | Owner | ClickUp Ticket | Status |
|------|-------|----------------|--------|
| Add `conversion_action_resource_name` + `conversion_label` to AdsAccount | - | [2.9](https://app.clickup.com/t/86b83wx7c) | TODO |
| Create `GoogleAds::Resources::ConversionAction` service | - | [2.9](https://app.clickup.com/t/86b83wx7c) | TODO |
| Call ConversionAction during AdsAccount sync | - | [2.9](https://app.clickup.com/t/86b83wx7c) | TODO |
| Inject gtag.js in buildable.rb | - | [2.6](https://app.clickup.com/t/86b7w8jp1) | TODO |
| Write VITE_GOOGLE_ADS_SEND_TO in buildable.rb | - | [2.6](https://app.clickup.com/t/86b7w8jp1) | TODO |
| Update tracking.ts with gclid + send_to | - | [2.6](https://app.clickup.com/t/86b7w8jp1) | TODO |
| Add gclid to Lead model | - | [Query Param Preservation](https://app.clickup.com/t/86b7u0ce8) | TODO |
| Capture gclid in tracking.ts | - | [Query Param Preservation](https://app.clickup.com/t/86b7u0ce8) | TODO |

---

## Testing Plan

### Unit Tests

**ConversionAction service:**
```ruby
# spec/services/google_ads/resources/conversion_action_spec.rb
- creates conversion action via API
- stores resource_name on ads_account
- queries and stores conversion_label
- handles API errors gracefully
```

**Lead model:**
```ruby
# spec/models/lead_spec.rb
- stores gclid from form submission
- validates email format
- ensures uniqueness per project
```

### Integration Tests

**buildable.rb:**
```ruby
# spec/models/concerns/website_deploy_concerns/buildable_spec.rb
- writes VITE_GOOGLE_ADS_SEND_TO when ads_account has conversion data
- omits VITE_GOOGLE_ADS_SEND_TO when no ads_account
- injects gtag.js script with correct conversion_id
- skips gtag injection when no conversion data
```

### E2E Tests

```typescript
// spec/e2e/lead_capture.spec.ts
test('gtag script present when ads account exists')
test('form submission fires conversion event')
test('gclid captured from URL and sent to API')
test('works without ads account (no gtag, lead still created)')
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No AdsAccount | No gtag injection, no VITE_GOOGLE_ADS_SEND_TO, lead still created |
| AdsAccount without ConversionAction | Skip gtag (shouldn't happen if flow is correct) |
| User has no gclid | Lead created without gclid, no attribution |
| Duplicate lead submission | Idempotent - return success, don't create duplicate |
