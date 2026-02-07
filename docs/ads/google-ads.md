# Google Ads

Launch10 creates and manages Google Ads campaigns on behalf of users. The system uses a **declarative field mapping** pattern — each Rails model (Campaign, AdGroup, Ad, Keyword) has a corresponding resource service that maps local fields to Google API fields with transforms (e.g., cents → micros). Campaigns are built locally first, then synced to Google in the background via the deploy pipeline.

## Architecture

```
AI generates campaign structure (Langgraph ads graph)
       │
       ▼
Rails models (Campaign, AdGroup, Ad, Keyword, Budget, LocationTarget)
       │
       ▼
Resource Services (GoogleAds::Resources::*)
  ├─ field_mapping declarations
  ├─ to_google_json() / from_google_json()
  ├─ compare_fields() for change detection
  └─ sync() → Google Ads API
       │
       ▼
CampaignDeploy (step-by-step background sync)
```

## Data Model

```
Campaign
  ├─ AdBudget (daily_budget_cents → micros)
  ├─ AdGroup[]
  │   ├─ Ad[] (headlines + descriptions)
  │   └─ AdKeyword[] (broad/phrase/exact)
  ├─ AdLocationTarget[] (geo or radius)
  ├─ AdSchedule[] (day/time targeting)
  ├─ AdLanguage[]
  └─ AdStructuredSnippet
```

All models store Google-specific data in `platform_settings` (JSONB): `google.campaign_id`, `google.ad_group_id`, `google.status`, etc.

## Field Mapping Pattern

Each resource declares mappings between local and remote fields:

```ruby
field_mapping :amount_micros,
  local: :daily_budget_cents,
  transform: CENTS_TO_MICROS,        # 1 cent = 10,000 micros
  reverse_transform: MICROS_TO_CENTS
```

This enables: `to_google_json()` for sync, `compare_fields()` for change detection, and `sync_plan()` for dry-run previews.

## Campaign Types

| Channel | Default Networks | Bidding |
|---------|-----------------|---------|
| SEARCH | Google Search + Search Network + Display Expansion | MAXIMIZE_CLICKS |
| DISPLAY | Content Network only | MAXIMIZE_CLICKS |
| VIDEO | YouTube + Google TV | MAXIMIZE_CLICKS |
| PERFORMANCE_MAX | All networks (auto) | MAXIMIZE_CONVERSIONS |

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/models/campaign.rb` | Campaign model (status, stage, platform_settings) |
| `rails_app/app/models/ad_group.rb` | Ad group with keywords and ads |
| `rails_app/app/models/ad.rb` | Ad with headlines and descriptions |
| `rails_app/app/models/ad_keyword.rb` | Keyword (text, match_type, position) |
| `rails_app/app/models/ad_budget.rb` | Budget (daily_budget_cents) |
| `rails_app/app/models/ad_location_target.rb` | Geo/radius targeting |
| `rails_app/app/services/google_ads.rb` | Google Ads API client setup |
| `rails_app/app/services/google_ads/resources/field_mappable.rb` | Declarative field mapping base |
| `rails_app/app/services/google_ads/resources/campaign.rb` | Campaign sync resource |
| `rails_app/app/services/google_ads/sync/sync_result.rb` | Sync result (created/updated/unchanged/error) |
| `rails_app/app/services/google_ads/sync/plan.rb` | Dry-run sync plan |
| `langgraph_app/app/graphs/ads.ts` | Ads generation graph |

## Gotchas

- **Cents vs micros**: Google Ads uses micros (1 cent = 10,000 micros). The `CENTS_TO_MICROS` transform handles conversion, but be careful when reading raw API responses.
- **Immutable fields**: `advertising_channel_type` can't be changed after campaign creation. The field mapping system marks these with `immutable: true`.
- **GAQL queries**: Google Ads uses its own query language (GAQL), not REST. Resource services build GAQL `SELECT` statements for fetching remote state.
- **Status cascade**: Enabling a campaign requires: channel type set, bidding strategy configured, customer ID linked, and billing approved.
