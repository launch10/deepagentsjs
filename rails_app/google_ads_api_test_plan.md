# Google Ads API Test Plan

## Overview

This document provides a comprehensive test plan for the Google Ads API integration, documenting test coverage, verification steps, and gaps.

## Test MCC Account

**Always verify changes in our Test MCC account: 124-895-7009**

## Resource Coverage Matrix

| Resource | Syncer Class | Create | Update | Delete/Unlink | Notes |
|----------|--------------|--------|--------|---------------|-------|
| Account (Customer) | `GoogleAds::Account` | ✅ | ✅ | ✅ | Sets status to CANCELED |
| Account Invitation | `GoogleAds::AccountInvitation` | ✅ | N/A | N/A | Check accepted/pending/declined status |
| Budget | `GoogleAds::Budget` | ✅ | ✅ | ✅ | Campaign budgets can be deleted |
| Campaign | `GoogleAds::Campaign` | ✅ | ✅ | ✅ | Campaigns can be removed |
| Location Target | `GoogleAds::LocationTarget` | ✅ | ✅ | ✅ | CampaignCriterion - can be removed |
| Ad Schedule | `GoogleAds::AdSchedule` | ✅ | ✅ (recreate) | ✅ | CampaignCriterion - can be removed |
| Callout | `GoogleAds::Callout` | ✅ | N/A | ✅ | Assets are immutable - unlink via CampaignAsset |
| Structured Snippet | `GoogleAds::StructuredSnippet` | ✅ | N/A | ✅ | Assets are immutable - unlink via CampaignAsset |
| Ad Group | `GoogleAds::AdGroup` | ✅ | ✅ | ✅ | Ad groups can be removed |
| Keyword | `GoogleAds::Keyword` | ✅ | N/A | ✅ | AdGroupCriterion - can be removed |
| Ad | `GoogleAds::Ad` | ✅ | ✅ | ✅ | AdGroupAd - can be removed |

## sync.rb Integration Steps

The `bin/sync.rb` script exercises the following integration steps:

1. `:connect_google_account` - Verifies Google account connection (placeholder)
2. `:create_ads_account` - Creates a new Google Ads customer account
3. `:send_account_invitation` - Sends invitation to user
4. `:sync_budget` - Creates/updates campaign budget
5. `:create_campaign` - Creates the campaign
6. `:create_geo_targeting` - Creates location targets
7. `:create_schedule` - Creates ad schedules
8. `:create_callouts` - Creates callout assets and links them
9. `:create_structured_snippets` - Creates structured snippet assets
10. `:create_ad_groups` - Creates ad groups
11. `:create_keywords` - Creates keywords
12. `:create_ads` - Creates responsive search ads

## Test Coverage Analysis

### Fully Tested (Create/Update/Delete or equivalent)

1. **GoogleAds::Account** - Full coverage including:
   - `#sync` for create and update
   - `#delete` which sets status to CANCELED

2. **GoogleAds::Budget** - Full coverage including:
   - `#sync` for create and update
   - `#delete` to remove campaign budget

3. **GoogleAds::Campaign** - Full coverage including:
   - `#sync` for create and update
   - `#delete` to remove campaign

4. **GoogleAds::LocationTarget** - Full coverage including:
   - `#sync` for create and update
   - `#delete` to remove campaign criterion

5. **GoogleAds::AdSchedule** - Full coverage including:
   - `#sync` for create and recreate (no update)
   - `#delete` to remove campaign criterion

6. **GoogleAds::AdGroup** - Full coverage including:
   - `#sync` for create and update
   - `#delete` to remove ad group

7. **GoogleAds::Keyword** - Full coverage including:
   - `#sync` for create
   - `#delete` to remove ad group criterion

8. **GoogleAds::Ad** - Full coverage including:
   - `#sync` for create and update (status only)
   - `#delete` to remove ad group ad

### Assets (Immutable - Tested with Unlink)

Assets cannot be deleted in Google Ads. Instead, you unlink them:

1. **GoogleAds::Callout** - Full coverage including:
   - `#sync` for create and link to campaign
   - `#delete` to unlink CampaignAsset

2. **GoogleAds::StructuredSnippet** - Full coverage including:
   - `#sync` for create and link to campaign
   - `#delete` to unlink CampaignAsset

## Deletion Patterns

### Standard Resources (Campaign, AdGroup, Budget, etc.)

```ruby
# Pattern: Use remove_resource operation
operation = client.operation.remove_resource.campaign(resource_name)
client.service.campaign.mutate_campaigns(
  customer_id: customer_id,
  operations: [operation]
)
```

### Campaign Criteria (LocationTarget, AdSchedule)

```ruby
# Pattern: Remove campaign criterion
operation = client.operation.remove_resource.campaign_criterion(
  "customers/#{customer_id}/campaignCriteria/#{campaign_id}~#{criterion_id}"
)
client.service.campaign_criterion.mutate_campaign_criteria(
  customer_id: customer_id,
  operations: [operation]
)
```

### Ad Group Criteria (Keywords)

```ruby
# Pattern: Remove ad group criterion
operation = client.operation.remove_resource.ad_group_criterion(
  "customers/#{customer_id}/adGroupCriteria/#{ad_group_id}~#{criterion_id}"
)
client.service.ad_group_criterion.mutate_ad_group_criteria(
  customer_id: customer_id,
  operations: [operation]
)
```

### Assets (Callouts, Structured Snippets, etc.)

Assets are immutable. To "delete" an asset, unlink it:

```ruby
# Pattern: Remove asset from campaign
operation = client.operation.remove_resource.campaign_asset(
  "customers/#{customer_id}/campaignAssets/#{campaign_id}~#{asset_id}~#{field_type}"
)
client.service.campaign_asset.mutate_campaign_assets(
  customer_id: customer_id,
  operations: [operation]
)
```

## UI Verification Steps

### Account Creation
1. Log into Google Ads with @launch10.com account
2. Select "Launch10 MCC Test Account" (124-895-7009)
3. Look for newly created customer account in the account list
4. Verify account name matches expected value

### Budget Verification
1. Navigate to customer account
2. Go to Tools & Settings > Billing > Budgets
3. Verify budget amount matches expected daily budget

### Campaign Verification
1. Navigate to Campaigns tab
2. Verify campaign exists with correct name
3. Check campaign status (ENABLED, PAUSED, etc.)

### Location Targeting
1. Navigate to Campaign > Settings > Locations
2. Verify targeted locations are listed
3. Check for excluded locations if applicable

### Ad Schedule
1. Navigate to Campaign > Settings > Ad Schedule
2. Verify days and hours match expected schedule

### Ad Groups and Ads
1. Navigate to Ad Groups tab
2. Verify ad group exists with correct name
3. Click into ad group to see ads
4. Verify responsive search ad headlines and descriptions

### Keywords
1. Navigate to Keywords tab within ad group
2. Verify keyword text and match type

## Running Tests

```bash
# Run all Google Ads specs
bundle exec rspec spec/services/google_ads/

# Run specific spec file
bundle exec rspec spec/services/google_ads/campaign_spec.rb

# Run with documentation format
bundle exec rspec spec/services/google_ads/ --format documentation
```

## End-to-End Testing

### Option 1: Manual E2E Testing with bin/sync.rb

The `bin/sync.rb` script exercises all integration steps with `binding.pry` breakpoints for inspection:

```bash
# Restore the campaign_complete snapshot first
bundle exec rake db:restore_snapshot[campaign_complete]

# Run the sync script (will pause at binding.pry)
bundle exec ruby bin/sync.rb
```

The script walks through all steps in order:
1. Create ads account
2. Send account invitation
3. Sync budget
4. Create campaign
5. Create geo targets (and test delete/resync)
6. Create schedule
7. Create callouts
8. Create structured snippets
9. Create ad groups
10. Create keywords
11. Create ads

### Option 2: LaunchCampaignService E2E Test

For automated E2E testing against the live API (with VCR cassettes):

```bash
# Run the launch campaign service spec (currently disabled with xdescribe)
# To enable: change xdescribe to describe in spec/services/google_ads/launch_campaign_service_spec.rb
GOOGLE_ADS_TEST_CUSTOMER_ID=1234567890 bundle exec rspec spec/services/google_ads/launch_campaign_service_spec.rb
```

### Option 3: Full Unit Test Suite (Recommended)

Run all 312 Google Ads unit tests (no API calls, uses mocks):

```bash
bundle exec rspec spec/services/google_ads/ --format documentation
```

This verifies all Create/Update/Delete operations work correctly without hitting the API.

### Verifying Changes in Google Ads UI

After running E2E tests, verify in Test MCC Account (124-895-7009):
1. Log into Google Ads with @launch10.com account
2. Select "Launch10 MCC Test Account"
3. Navigate to the customer account created
4. Verify all entities (budget, campaign, ad groups, ads, keywords, etc.)

## Key Test Infrastructure

### GoogleAdsMocks Module

Located at `spec/support/google_ads_mocks.rb`, provides:

- `mock_google_ads_client` - Sets up the mock client
- `mock_search_response_with_*` - Response builders for each resource type
- `mock_mutate_*_response` - Mutation response builders
- `mock_google_ads_error` - Error simulation
- `mock_empty_search_response` - For "not found" scenarios

### Test Pattern

All syncer specs follow this pattern:

1. **Setup**: Create local resource with factory
2. **Mock**: Configure mock responses
3. **Execute**: Call syncer methods (`#sync`, `#sync_result`, `#synced?`)
4. **Assert**: Verify SyncResult properties and local resource updates

## Important Notes

1. **Assets are immutable** - You cannot update or delete assets directly. Only link/unlink operations.

2. **Ad Schedules require recreation** - The Google Ads API doesn't support updating ad schedule criteria. Changes require delete + create.

3. **Auto-tagging** - Account sync automatically enables auto-tagging for conversion tracking.

4. **Customer ID format** - Always use string format with hyphens removed (e.g., "1234567890" not "123-456-7890").

5. **Resource names** - Follow pattern: `customers/{customer_id}/{resource_type}/{id}`

## Completed Test Coverage

### High Priority - COMPLETED ✅

1. Added `#delete` tests for:
   - ✅ Budget (4 tests: not_found, success, persistence, error handling)
   - ✅ Campaign (4 tests: not_found, success, persistence, error handling)
   - ✅ AdGroup (4 tests: not_found, success, persistence, error handling)
   - ✅ LocationTarget (4 tests: not_found, success, persistence, error handling)
   - ✅ AdSchedule (4 tests: not_found, success, persistence, error handling)
   - ✅ Keyword (4 tests: not_found, success, persistence, error handling)
   - ✅ Ad (4 tests: not_found, success, persistence, error handling)

2. Added asset unlink tests for:
   - ✅ Callout (4 tests: not_found, unlink success, persistence, error handling)
   - ✅ StructuredSnippet (4 tests: not_found, unlink success, persistence, error handling)

### Future Enhancements (Optional)

1. Add integration tests that verify the full sync.rb flow
2. Add error handling tests for network failures
3. Add rate limiting handling tests
4. Add tests for account unlinking from MCC
5. Add tests for invitation status transitions

## Troubleshooting Notes

### CampaignDeploy Test Failures (2025-01)

**Issue 1: `NoMethodError: undefined method 'define' for class CampaignDeploy::Steps`**

The `campaign_deploy.rb` file had a typo on line 124:
```ruby
# Wrong - Steps is a container class, not the Step DSL
Steps.define(:connect_google_account) do

# Correct - Step is the DSL class with the define method
Step.define(:connect_google_account) do
```

**Issue 2: Test expectations for first step**

When adding new steps to `CampaignDeploy::STEPS`, ensure tests expecting the first step are updated. Tests checking `STEPS.first.name` must reflect the actual first step (e.g., `:connect_google_account` instead of `:create_ads_account`).

**Issue 3: Mock status mismatch in `synced?` checks**

The `synced?` method compares local field values against remote values. When mocking ad groups, ensure the mock `status` matches the local default:

```ruby
# Local default is "PAUSED" (from platform_setting)
# Mock must also use PAUSED for synced? to return true
mock_search_response_with_ad_group(
  ad_group_id: 999,
  status: :PAUSED  # Not :ENABLED (the mock's default)
)
```

The `synced?` logic requires `comparisons.any? && values_match?`. All field comparisons (name, status, type, cpc_bid_micros) must match.

## Test Results

All 312 Google Ads specs pass:

```
$ bundle exec rspec spec/services/google_ads/ --format documentation
...
Finished in 22.24 seconds (files took 1.86 seconds to load)
312 examples, 0 failures, 1 pending
```

(The 1 pending test is an intentionally skipped integration test in `launch_campaign_service_spec.rb`)
