# AdCallout Google Sync Implementation Guide

This document provides instructions for implementing Google Ads sync functionality for `AdCallout` (callout assets) resources.

## Overview

Callouts are short snippets (max 25 chars) highlighting unique features. The sync is a two-step process:

1. Create an Asset (callout_asset) in Google Ads
2. Link the Asset to the Campaign via CampaignAsset

## Google Ads API Structure

### Step 1: Create Callout Asset

```ruby
AssetOperation.create:
  - callout_asset:
    - callout_text: "{unique_feature_text}"
```

### Step 2: Link to Campaign

```ruby
CampaignAssetOperation.create:
  - campaign: "customers/{customer_id}/campaigns/{campaign_id}"
  - asset: "customers/{customer_id}/assets/{asset_id}"
  - field_type: :CALLOUT
```

## Existing Model Structure

### AdCallout Model (`app/models/ad_callout.rb`)

- `belongs_to :campaign`
- `belongs_to :ad_group` (optional based on schema)
- `text` - the callout text (max 25 chars)
- `position` - ordering
- `platform_settings` with `google.asset_id`

## Architecture Pattern

### 1. Model Layer (`app/models/ad_callout.rb`)

Add:

```ruby
include GoogleMappable
include GoogleSyncable

use_google_sync GoogleAds::Callout

after_google_sync do |result|
  if result.resource_name.present?
    # Resource name format: customers/{customer_id}/assets/{asset_id}
    asset_id = result.resource_name.split("/").last
    update_column(:platform_settings, platform_settings.deep_merge("google" => { "asset_id" => asset_id }))
  end
end
```

### 2. Syncer Class (`app/services/google_ads/callout.rb`)

```ruby
module GoogleAds
  class Callout < Sync::Syncable
    def campaign
      local_resource.campaign
    end

    def fetch_remote
      fetch_by_id
    end

    def fetch_by_id
      return nil unless remote_asset_id.present?

      query = %(
        SELECT asset.id, asset.name, asset.callout_asset.callout_text
        FROM asset
        WHERE asset.id = #{remote_asset_id}
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      results.first&.asset
    end

    def sync_result
      return not_found_result(:asset) unless remote_resource

      Sync::SyncResult.new(
        resource_type: :asset,
        resource_name: remote_resource.resource_name,
        action: :unchanged,
        comparisons: build_comparisons
      )
    end

    def sync
      return sync_result if synced?

      if remote_resource
        # Assets cannot be updated, would need to recreate
        sync_result
      else
        create_callout_asset
      end
    end

    private

    def remote_asset_id
      local_resource.google_asset_id
    end
    memoize :remote_asset_id

    def google_customer_id
      campaign.google_customer_id.to_s
    end

    def google_campaign_id
      campaign.google_campaign_id.to_s
    end

    def campaign_resource_name
      "customers/#{google_customer_id}/campaigns/#{google_campaign_id}"
    end

    def create_callout_asset
      # Step 1: Create the asset
      asset_operation = client.operation.create_resource.asset do |asset|
        asset.callout_asset = client.resource.callout_asset do |ca|
          ca.callout_text = local_resource.text
        end
      end

      begin
        asset_response = client.service.asset.mutate_assets(
          customer_id: google_customer_id,
          operations: [asset_operation]
        )
      rescue => e
        return error_result(:asset, e)
      end

      asset_resource_name = asset_response.results.first.resource_name
      asset_id = asset_resource_name.split("/").last.to_i
      local_resource.google_asset_id = asset_id

      # Step 2: Link asset to campaign
      link_operation = client.operation.create_resource.campaign_asset do |ca|
        ca.campaign = campaign_resource_name
        ca.asset = asset_resource_name
        ca.field_type = :CALLOUT
      end

      begin
        client.service.campaign_asset.mutate_campaign_assets(
          customer_id: google_customer_id,
          operations: [link_operation]
        )
      rescue => e
        return error_result(:campaign_asset, e)
      end

      verify_sync(:created, asset_resource_name)
    end

    def verify_sync(action, resource_name)
      clear_memoization
      fetch_remote

      Sync::SyncResult.new(
        resource_type: :asset,
        resource_name: resource_name,
        action: action,
        comparisons: build_comparisons
      )
    end

    def clear_memoization
      flush_cache(:remote_resource)
      flush_cache(:synced?)
      flush_cache(:sync_result)
      flush_cache(:remote_asset_id)
    end
  end
end
```

### 3. Field Mappings (`app/services/google_ads/sync/field_mappings.rb`)

```ruby
CALLOUT_FIELDS = {
  text: {
    our_field: :text,
    their_field: :callout_text,
    transform: ITSELF,
    nested_field: :callout_asset
  }
}.freeze

# Add to self.for method:
when ::AdCallout.name
  CALLOUT_FIELDS
```

### 4. Test Mocks (`spec/support/google_ads_mocks.rb`)

Mock services already exist (`@mock_asset_service`, `@mock_campaign_asset_service`).

Add/verify helpers:

```ruby
def mock_search_response_with_callout_asset(
  asset_id: 88888,
  customer_id: 456,
  callout_text: "Free Shipping"
)
  callout_asset = double("CalloutAsset", callout_text: callout_text)

  asset = double("Asset",
    resource_name: "customers/#{customer_id}/assets/#{asset_id}",
    id: asset_id,
    callout_asset: callout_asset)

  row = double("GoogleAdsRow", asset: asset)
  [row]
end

def mock_callout_asset_resource
  double("CalloutAsset").tap do |ca|
    allow(ca).to receive(:callout_text=)
  end
end
```

### 5. Syncer Spec (`spec/services/google_ads/callout_spec.rb`)

Test scenarios:

- `#local_resource` returns the callout
- `#campaign` returns the campaign
- `#fetch_remote` fetches by asset_id
- `#sync_result` returns correct state
- `#synced?` returns true when text matches
- `#sync` creates asset and links to campaign when not exists
- `#sync` returns sync_result when already synced
- Error handling when API calls fail
- Model helper methods (#google_synced?, #google_sync_result, #google_sync)
- after_google_sync callback sets asset_id

## Implementation Checklist

1. [ ] Write requirements doc to disk ✓
2. [ ] Examine existing AdCallout model and factory ✓
3. [ ] Verify mock helpers exist for Asset and CampaignAsset services
4. [ ] Write specs for GoogleAds::Callout syncer (RED)
5. [ ] Implement GoogleAds::Callout syncer (GREEN)
6. [ ] Update AdCallout model with GoogleSyncable
7. [ ] Add CALLOUT_FIELDS to FieldMappings
8. [ ] Run tests and fix failures
9. [ ] Refactor if needed

## Key Differences from Other Syncers

1. **Two-step sync**: Unlike keywords or ad schedules, callouts require:
   - Creating an Asset first
   - Then linking it to a Campaign via CampaignAsset

2. **Immutable assets**: Once created, callout assets cannot be updated. To change text, you'd need to create a new asset and re-link.

3. **Resource name format**: Assets use `customers/{id}/assets/{asset_id}` (no tilde separator like criteria).

## Running Tests

```bash
# Run specific specs
bundle exec rspec spec/services/google_ads/callout_spec.rb

# Run all Google Ads specs
bundle exec rspec spec/services/google_ads/
```
