# Google Ads V2 Branch Documentation

## Branch Overview
- **Branch**: `google-ads-v2`
- **Base**: `main`
- **Commits**: 96
- **Changes**: 128 files, +14,881 / -13,066 lines

## What This Branch Implements

A complete Google Ads integration for deploying ad campaigns from Launch10. This includes:

1. **Google Ads API Service Layer** - Individual syncers for each Google Ads resource type
2. **Collection Sync Architecture** - Handles soft-deletes and batch syncs
3. **Campaign Deploy Step System** - Orchestrates multi-step campaign deployment
4. **Frontend Forms** - Launch and Review forms for campaign workflow

---

## Architecture

### 1. Individual Syncers (`app/services/google_ads/`)

Each Google Ads resource has a dedicated syncer extending `Sync::Syncable`:

| File | Resource | Description |
|------|----------|-------------|
| `account.rb` | Customer Account | Creates/verifies Google Ads accounts |
| `account_invitation.rb` | Account Invitation | Sends invitation emails to users |
| `budget.rb` | Campaign Budget | Daily budget configuration |
| `campaign.rb` | Campaign | The main campaign resource |
| `location_target.rb` | Campaign Criterion (Geo) | Location targeting |
| `ad_schedule.rb` | Campaign Criterion (Schedule) | Day/time scheduling |
| `callout.rb` | Asset + CampaignAsset | Callout extensions |
| `structured_snippet.rb` | Asset + CampaignAsset | Structured snippet extensions |
| `ad_group.rb` | Ad Group | Ad groups within campaign |
| `keyword.rb` | Ad Group Criterion | Keywords within ad groups |
| `ad.rb` | Ad Group Ad | Responsive search ads |
| `favicon.rb` | Asset | Favicon image asset |

### 2. Collection Syncers (`app/services/google_ads/`)

For resources that need batch create/update/delete:

| File | Syncs | Handles Deletes |
|------|-------|-----------------|
| `location_targets.rb` | Campaign location targets | Yes |
| `ad_schedules.rb` | Campaign ad schedules | Yes |
| `callouts.rb` | Campaign callouts | Yes |
| `structured_snippets.rb` | Campaign snippets | Yes |
| `keywords.rb` | Ad group keywords | Yes |

### 3. Sync Infrastructure (`app/services/google_ads/sync/`)

| File | Purpose |
|------|---------|
| `syncable.rb` | Base class for individual resource syncers |
| `collection_syncable.rb` | Base class for collection syncers |
| `field_mappings.rb` | Defines field mappings between our models and Google Ads API |
| `field_comparison.rb` | Compares local vs remote values, handles transforms |
| `sync_result.rb` | Result object for individual syncs |
| `collection_sync_result.rb` | Result object for collection syncs |

### 4. Model Concerns

| Concern | Purpose |
|---------|---------|
| `GoogleSyncable` | Adds `use_google_sync` and `use_google_collection_sync` DSL |
| `GoogleMappable` | Adds `to_google_json` / `from_google_json` methods |
| Platform settings concerns | Define google-specific fields per model |

---

## Campaign Deploy System

### Step Definitions (`app/models/campaign_deploy.rb`)

The deploy process runs 10 steps in sequence:

```
1. create_ads_account      - Create/verify Google Ads account
2. send_account_invitation - Send invitation email to user
3. sync_budget             - Create campaign budget
4. create_campaign         - Create the campaign
5. create_geo_targeting    - Sync location targets (collection)
6. create_schedule         - Sync ad schedules (collection)
7. create_assets           - Sync callouts + snippets (collections)
8. create_ad_groups        - Create ad groups
9. create_keywords         - Sync keywords per ad group (collection)
10. create_ads             - Create responsive search ads
```

### Step DSL

```ruby
Step.define(:step_name) do
  def run
    # Execute the step (access @campaign)
  end

  def finished?
    # Return boolean - is step complete?
  end

  def sync_result
    # Return SyncResult or CollectionSyncResult
  end
end
```

### StepRunner API

```ruby
runner = CampaignDeploy::StepRunner.new(campaign)
step = runner.find(:create_ads_account)
step.run
step.finished?  # => true/false
step.sync_result
```

---

## Collection Sync DSL

Models use a DSL to register collection syncers:

```ruby
class Campaign < ApplicationRecord
  include GoogleSyncable

  use_google_sync GoogleAds::Campaign
  use_google_collection_sync :location_targets, GoogleAds::LocationTargets
  use_google_collection_sync :ad_schedules, GoogleAds::AdSchedules
  use_google_collection_sync :callouts, GoogleAds::Callouts
  use_google_collection_sync :structured_snippets, GoogleAds::StructuredSnippets
end
```

This generates:
- `campaign.sync_location_targets` - Syncs all targets (create/update/delete)
- `campaign.location_targets_synced?` - All synced?
- `campaign.location_targets_sync_result` - Last sync result
- `campaign.location_targets_syncer` - Get syncer instance

---

## Field Mapping System

Defined in `app/services/google_ads/sync/field_mappings.rb`:

```ruby
CAMPAIGN = {
  name: {
    our_field: :google_name,
    their_field: :name
  },
  contains_eu_political_advertising: {
    our_field: :google_contains_eu_political_advertising,
    their_field: :contains_eu_political_advertising,
    transform: ->(value) { value ? :CONTAINS_EU_POLITICAL_ADVERTISING : :DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING },
    their_value_transform: ->(value) { value == :UNSPECIFIED ? :DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING : value },
    immutable: true
  }
}
```

Key features:
- `transform` - Convert our value to Google format
- `their_value_transform` - Normalize Google's value before comparison
- `immutable` - Field can only be set on create

---

## Testing

### Test Files
- `spec/models/campaign_deploy_spec.rb` - 60 tests for step system
- `spec/services/google_ads/*_spec.rb` - Tests for each syncer
- `spec/support/google_ads_mocks.rb` - Shared mock helpers

### Running Tests

```bash
# All campaign deploy tests
bundle exec rspec spec/models/campaign_deploy_spec.rb

# All Google Ads service tests
bundle exec rspec spec/services/google_ads/

# Specific syncer
bundle exec rspec spec/services/google_ads/location_target_spec.rb
```

### Snapshot Builder

```ruby
# Rebuild campaign_complete snapshot (rails console)
load 'spec/snapshot_builders/campaign_complete.rb'
CampaignComplete.new.build
```

---

## Frontend Changes

### New Components
- `LaunchForm` - Form for launching campaigns
- `ReviewForm` - Review campaign before launch
- `ReviewItem` / `ReviewItemList` - Display campaign details
- `InfoTooltip`, `InputDatePicker` - Shared form components

### Workflow
- `useCampaignPagination` hook for step navigation
- `WorkflowStepsProvider` for state management
- Edit Section jump back/forth from Review step

---

## Current Status

### Completed
- All 10 deploy steps implemented
- All individual syncers complete
- All collection syncers complete (with delete support)
- Field comparison with transforms
- Step DSL and StepRunner
- 60 tests passing for CampaignDeploy
- Frontend forms and workflow

### What Needs Testing
- End-to-end campaign deploy against real Google Ads API
- Verify all field mappings match Google's expectations
- Test soft-delete flows in production

---

## Key Fixes Made

1. **`their_value_transform`** - Added to handle Google returning `:UNSPECIFIED` for unset enum fields

2. **Platform settings default** - Changed `options[:default]` to `options.key?(:default)` so `false` defaults work

3. **Location target deletion** - Set `resource_name: nil` in delete result to prevent `after_google_sync` callback from re-writing the ID

4. **Step DSL** - Added `alias_method :name, :step_name` and fixed `next_step` to return instantiated step

---

## Commands

```bash
# Run campaign deploy tests
bundle exec rspec spec/models/campaign_deploy_spec.rb

# Run all Google Ads tests
bundle exec rspec spec/services/google_ads/

# Sync script
bin/sync.rb

# Dev servers
bin/dev  # Rails
```

---

## File Locations Quick Reference

| Category | Path |
|----------|------|
| Individual syncers | `app/services/google_ads/*.rb` |
| Sync infrastructure | `app/services/google_ads/sync/*.rb` |
| Model concerns | `app/models/concerns/google_*.rb` |
| Campaign deploy | `app/models/campaign_deploy.rb` |
| Step specs | `spec/models/campaign_deploy_spec.rb` |
| Syncer specs | `spec/services/google_ads/*_spec.rb` |
| Mock helpers | `spec/support/google_ads_mocks.rb` |
| Snapshot builder | `spec/snapshot_builders/campaign_complete.rb` |
