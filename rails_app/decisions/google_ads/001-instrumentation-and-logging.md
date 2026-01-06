# ADR-001: Google Ads API Instrumentation and Logging

**Status**: Accepted
**Date**: 2025-01-05

## Context

We needed observability into Google Ads API operations to:
- Debug sync issues in production
- Track which operations are being called and when
- Filter logs by domain model IDs (campaign, ad group, etc.)
- Understand API call patterns without building custom infrastructure

### Options Considered

1. **Custom database table** - Store all API requests/responses in a dedicated table
   - Pros: Full queryability, historical data
   - Cons: Storage overhead, schema maintenance, additional writes on every API call

2. **Google Ads gem's built-in LoggingInterceptor + Tagged Logging**
   - Pros: Zero custom infrastructure, uses Rails conventions, filterable via log aggregators
   - Cons: Requires log aggregation service for production querying

## Decision

Use the **Google Ads gem's built-in LoggingInterceptor** combined with **Rails ActiveSupport::TaggedLogging** for contextual tagging.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Resource Class                            │
│  (Campaign, AdGroup, Ad, Budget, Keyword, etc.)             │
├─────────────────────────────────────────────────────────────┤
│  include Instrumentable                                      │
│  instrument_methods :sync, :sync_result, :sync_plan, etc.   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              GoogleAds::Instrumentation                      │
│  with_context(campaign:, ad_group:, ad:, keyword:, budget:) │
│  - Builds tags from domain objects                          │
│  - Wraps block with tagged logging                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Rails Tagged Logging                               │
│  [campaign_id=123] [google_customer_id=456] ...             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│        Google Ads Gem LoggingInterceptor                    │
│  INFO  = Request summaries (method, customer_id, duration)  │
│  DEBUG = Full request/response JSON payloads                │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Instrumentable Concern

Each resource class includes `Instrumentable` and defines:

```ruby
module GoogleAds
  module Resources
    class Campaign
      include FieldMappable
      include Instrumentable

      def instrumentation_context
        { campaign: record }
      end

      instrument_methods :sync, :sync_result, :sync_plan, :delete, :fetch
    end
  end
end
```

### 2. Instrumentation Module

The `GoogleAds::Instrumentation` module:
- Accepts domain objects (campaign, ad_group, ad, keyword, budget)
- Extracts IDs using our naming conventions
- Wraps execution with Rails tagged logging

```ruby
GoogleAds::Instrumentation.with_context(campaign: campaign) do
  # All logs inside here are tagged with:
  # [campaign_id=X] [google_customer_id=Y] [account_id=Z]
end
```

### 3. Naming Convention

**Critical**: Tags use our internal naming conventions for our IDs, but Google's naming for their IDs:

| Tag | Source | Example |
|-----|--------|---------|
| `campaign_id` | `campaign.id` | Our internal ID |
| `ad_group_id` | `ad_group.id` | Our internal ID |
| `ad_id` | `ad.id` | Our internal ID |
| `budget_id` | `budget.id` | Our internal ID |
| `keyword_id` | `keyword.id` | Our internal ID |
| `account_id` | `account.id` | Our internal ID |
| `google_customer_id` | `campaign.google_customer_id` | Google's customer ID |

This ensures logs are searchable by our domain model IDs while clearly distinguishing Google's external identifiers.

### 4. Log Levels

Configure in `config/initializers/google_ads.rb`:

```ruby
Google::Ads::GoogleAds::Config.new do |c|
  c.log_level = Rails.env.production? ? :INFO : :DEBUG
end
```

- **INFO**: Request summaries (recommended for production)
- **DEBUG**: Full JSON payloads (useful for development/debugging)

## Instrumented Resources

### Full Test Coverage (with tag-level assertions)

| Resource | Context Keys |
|----------|-------------|
| Campaign | `campaign_id`, `google_customer_id`, `account_id` |
| AdGroup | `ad_group_id`, `campaign_id`, `google_customer_id`, `account_id` |
| Ad | `ad_id`, `ad_group_id`, `campaign_id`, `google_customer_id`, `account_id` |
| Budget | `budget_id`, `campaign_id`, `google_customer_id`, `account_id` |
| Keyword | `keyword_id`, `ad_group_id`, `campaign_id`, `google_customer_id`, `account_id` |

### Campaign-Level Context

These resources pass `campaign: record.campaign` to inherit campaign tags:

- AdSchedule
- Callout
- LocationTarget
- StructuredSnippet
- Favicon

### Account-Level Context

| Resource | Context Keys |
|----------|-------------|
| Account | `account_id`, `google_customer_id` |
| AccountInvitation | `google_customer_id` |

## Consequences

### Positive

- **Zero infrastructure**: No new tables, no additional writes
- **Rails-native**: Uses standard tagged logging patterns
- **Filterable**: Log aggregators (Papertrail, Datadog, etc.) can filter by any tag
- **Debuggable**: DEBUG level shows full API payloads when needed
- **Testable**: Instrumentation is tested at the tag level in specs

### Negative

- **Ephemeral**: Logs rotate; no permanent historical record
- **Aggregator-dependent**: Production querying requires log aggregation service
- **Volume**: DEBUG level can be verbose; use INFO in production

## Example Log Output

```
[campaign_id=42] [google_customer_id=1234567890] [account_id=7]
  Google::Ads::GoogleAds V18 CampaignService.mutate_campaigns
  Request: customer_id=1234567890, operations=[...]
  Response: results=[{resource_name: "customers/1234567890/campaigns/999"}]
  Duration: 234ms
```

## Testing

Each instrumented resource has specs asserting:

1. Methods are wrapped with `GoogleAds::Instrumentation.with_context`
2. Correct context keys are passed (e.g., `campaign:`, `ad_group:`)
3. Tag values match expected IDs

Example spec pattern:

```ruby
describe "instrumentation" do
  it "wraps sync with instrumentation context" do
    expect(GoogleAds::Instrumentation).to receive(:with_context)
      .with(hash_including(campaign: campaign))
      .and_call_original

    resource.sync
  end
end
```

## Datadog Integration (Production)

### Tag Format

Tags are formatted as `key=value` strings for log aggregator compatibility:

```
[campaign_id=42] [google_customer_id=1234567890] [account_id=7] message
```

This format is automatically parsed by Datadog as facets.

### Datadog Search Examples

```
@campaign_id:42
@google_customer_id:1234567890
@account_id:7 service:rails_app
```

### Datadog MCP Server

Datadog provides an official MCP server that enables AI agents to query logs, traces, and metrics directly:

```bash
claude mcp add datadog \
  -e DD_API_KEY=<api-key> \
  -e DD_APP_KEY=<app-key> \
  -e DD_SITE=datadoghq.com \
  -- npx -y @datadog/mcp-server
```

Available tools:
- `get_logs` - Search logs by query filters
- `list_spans` / `get_trace` - Investigate traces
- `list_metrics` / `get_metrics` - Query metrics
- `get_monitors` - Check monitor status
- `list_incidents` - Review incidents

### Setup Checklist

Before production deployment:

1. **Install Datadog agent** on production servers
2. **Configure log shipping** to forward Rails logs to Datadog
3. **Create facets** for our custom tags (campaign_id, google_customer_id, account_id, etc.)
4. **Set up monitors** for Google Ads API errors
5. **(Optional)** Configure MCP server for AI-assisted debugging

### Pipeline Rules (Optional)

If tags aren't auto-extracted, add a Datadog pipeline rule:

```
Pattern: \[(\w+)=([^\]]+)\]
Extract: $1 -> $2
```

## References

- Google Ads Ruby gem logging: https://github.com/googleads/google-ads-ruby#logging
- Rails Tagged Logging: https://api.rubyonrails.org/classes/ActiveSupport/TaggedLogging.html
- Datadog MCP Server: https://docs.datadoghq.com/bits_ai/mcp_server/
- `app/services/google_ads/instrumentation.rb`
- `app/services/google_ads/resources/instrumentable.rb`
