# AdGroupAd Google Sync Implementation Guide

This document provides instructions for implementing Google Ads sync functionality for `Ad` (AdGroupAd) resources, following established patterns in the codebase.

## Overview

The goal is to sync local `Ad` records (responsive search ads) to Google Ads using `AdGroupAdOperation.create`. This involves:

1. Syncing the `Ad` model with its associated `AdHeadline` and `AdDescription` records
2. Getting `final_urls` from the associated Website's Domain
3. Optionally including `display_path_1` and `display_path_2` (display paths shown in the ad URL)

## Google Ads API Structure

```ruby
AdGroupAdOperation.create:
  - ad_group: "customers/{customer_id}/adGroups/{ad_group_id}"
  - ad:
    - final_urls: ["https://example.com"]
    - responsive_search_ad:
      - headlines: [
          { text: "Headline 1", pinned_field: :HEADLINE_1 },  # if position == 0
          { text: "Headline 2" },
          ...
        ]
      - descriptions: [
          { text: "Description 1", pinned_field: :DESCRIPTION_1 },  # if position == 0
          { text: "Description 2" },
          ...
        ]
      - path1: "optional-path"   # Display URL path segment 1 (max 15 chars)
      - path2: "optional-path"   # Display URL path segment 2 (max 15 chars)
  - status: :PAUSED  # or :ENABLED
```

### About Display Paths (path1, path2)

Display paths are optional URL path segments that appear in the ad's display URL but don't affect the actual landing page URL. For example:

- Final URL: `https://example.com/products/shoes`
- Display URL with paths: `example.com/Shoes/Sale`

They help make the display URL more relevant to the ad content. Max 15 characters each. The existing `Ad` model already has `display_path_1` and `display_path_2` columns.

### About Pinned Fields

Headlines/descriptions can be "pinned" to specific positions:

- `HEADLINE_1`, `HEADLINE_2`, `HEADLINE_3` for headlines
- `DESCRIPTION_1`, `DESCRIPTION_2` for descriptions

In our model, if an `AdHeadline` has `position == 0`, it should be pinned to `HEADLINE_1`. Similarly for descriptions.

## Architecture Pattern

Follow the existing sync architecture:

### 1. Model Layer (`app/models/ad.rb`)

The `Ad` model needs:

- `include GoogleMappable` (already has PlatformSettings)
- `include GoogleSyncable`
- `use_google_sync GoogleAds::Ad`
- `after_google_sync` callback to store the ad_id

```ruby
# Ad model additions
include GoogleMappable
include GoogleSyncable

use_google_sync GoogleAds::Ad

after_google_sync do |result|
  if result.resource_name.present?
    # Resource name format: customers/{customer_id}/adGroupAds/{ad_group_id}~{ad_id}
    ad_id = result.resource_name.split("~").last
    update_column(:platform_settings, platform_settings.deep_merge("google" => { "ad_id" => ad_id }))
  end
end

def final_urls
  # Get from website's primary domain
  # Navigate: ad -> ad_group -> campaign -> website -> domains.first
  website = campaign&.website
  return [] unless website&.domains&.any?

  domain = website.domains.first.domain
  ["https://#{domain}"]
end
```

### 2. Syncer Class (`app/services/google_ads/ad.rb`)

Create following the pattern from `GoogleAds::Keyword`:

```ruby
module GoogleAds
  class Ad < Sync::Syncable
    def ad_group
      local_resource.ad_group
    end

    def campaign
      ad_group.campaign
    end

    def fetch_remote
      fetch_by_id
    end

    def fetch_by_id
      return nil unless remote_ad_id.present?

      query = %(
        SELECT ad_group_ad.resource_name, ad_group_ad.ad.id, ad_group_ad.ad.final_urls,
               ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions,
               ad_group_ad.ad.responsive_search_ad.path1, ad_group_ad.ad.responsive_search_ad.path2,
               ad_group_ad.status
        FROM ad_group_ad
        WHERE ad_group_ad.ad.id = #{remote_ad_id}
        AND ad_group_ad.ad_group = 'customers/#{google_customer_id}/adGroups/#{google_ad_group_id}'
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      results.first&.ad_group_ad
    end

    def sync_result
      return not_found_result(:ad_group_ad) unless remote_resource

      Sync::SyncResult.new(
        resource_type: :ad_group_ad,
        resource_name: remote_resource.resource_name,
        action: :unchanged,
        comparisons: build_comparisons
      )
    end

    def sync
      return sync_result if synced?

      if remote_resource
        update_ad
      else
        create_ad
      end
    end

    private

    def remote_ad_id
      local_resource.google_ad_id
    end
    memoize :remote_ad_id

    def google_customer_id
      campaign.google_customer_id.to_s
    end

    def google_ad_group_id
      ad_group.google_ad_group_id.to_s
    end

    def ad_group_resource_name
      "customers/#{google_customer_id}/adGroups/#{google_ad_group_id}"
    end

    def create_ad
      operation = client.operation.create_resource.ad_group_ad do |aga|
        aga.ad_group = ad_group_resource_name
        aga.status = google_status
        aga.ad = client.resource.ad do |ad|
          ad.final_urls += local_resource.final_urls
          ad.responsive_search_ad = client.resource.responsive_search_ad_info do |rsa|
            local_resource.headlines.order(:position).each do |headline|
              rsa.headlines << build_headline_asset(headline)
            end
            local_resource.descriptions.order(:position).each do |description|
              rsa.descriptions << build_description_asset(description)
            end
            rsa.path1 = local_resource.display_path_1 if local_resource.display_path_1.present?
            rsa.path2 = local_resource.display_path_2 if local_resource.display_path_2.present?
          end
        end
      end

      begin
        response = client.service.ad_group_ad.mutate_ad_group_ads(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:ad_group_ad, e)
      end

      resource_name = response.results.first.resource_name
      ad_id = resource_name.split("~").last.to_i
      local_resource.google_ad_id = ad_id

      verify_sync(:created, resource_name)
    end

    def build_headline_asset(headline)
      client.resource.ad_text_asset do |asset|
        asset.text = headline.text
        # Pin if position is 0, 1, or 2 (first three positions)
        if headline.position <= 2
          asset.pinned_field = pinned_headline_field(headline.position)
        end
      end
    end

    def build_description_asset(description)
      client.resource.ad_text_asset do |asset|
        asset.text = description.text
        # Pin if position is 0 or 1 (first two positions)
        if description.position <= 1
          asset.pinned_field = pinned_description_field(description.position)
        end
      end
    end

    def pinned_headline_field(position)
      case position
      when 0 then :HEADLINE_1
      when 1 then :HEADLINE_2
      when 2 then :HEADLINE_3
      end
    end

    def pinned_description_field(position)
      case position
      when 0 then :DESCRIPTION_1
      when 1 then :DESCRIPTION_2
      end
    end

    def google_status
      case local_resource.status
      when "active" then :ENABLED
      else :PAUSED
      end
    end

    def update_ad
      # Note: Many RSA fields cannot be updated after creation
      # You may need to remove and recreate like AdSchedule does
      # For now, implement basic status update
      resource_name = remote_resource.resource_name

      operation = client.operation.update_resource.ad_group_ad(resource_name) do |aga|
        aga.status = google_status
      end

      begin
        client.service.ad_group_ad.mutate_ad_group_ads(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:ad_group_ad, e)
      end

      verify_sync(:updated, resource_name)
    end

    def verify_sync(action, resource_name)
      clear_memoization
      fetch_remote

      Sync::SyncResult.new(
        resource_type: :ad_group_ad,
        resource_name: resource_name,
        action: action,
        comparisons: build_comparisons
      )
    end

    def clear_memoization
      flush_cache(:remote_resource)
      flush_cache(:synced?)
      flush_cache(:sync_result)
      flush_cache(:remote_ad_id)
    end
  end
end
```

### 3. Field Mappings (`app/services/google_ads/sync/field_mappings.rb`)

Add mappings for Ad fields. Note: For complex nested structures like headlines/descriptions, you may need custom comparison logic rather than simple field mappings:

```ruby
AD_FIELDS = {
  status: {
    our_field: :status,
    their_field: :status,
    transform: ->(status) { status == "active" ? :ENABLED : :PAUSED }
  },
  display_path_1: {
    our_field: :display_path_1,
    their_field: :path1,
    transform: ITSELF,
    nested_field: :responsive_search_ad
  },
  display_path_2: {
    our_field: :display_path_2,
    their_field: :path2,
    transform: ITSELF,
    nested_field: :responsive_search_ad
  }
}.freeze

# Add to self.for method:
when ::Ad.name
  AD_FIELDS
```

### 4. Test Mocks (`spec/support/google_ads_mocks.rb`)

Add mock helpers:

```ruby
def mock_ad_group_ad_service
  @mock_ad_group_ad_service = double("AdGroupAdService")
  # Add to the services double in mock_google_ads_client
end

def mock_search_response_with_ad_group_ad(
  ad_id: 12345,
  ad_group_id: 999,
  customer_id: 456,
  status: :PAUSED,
  final_urls: ["https://example.com"],
  headlines: [],
  descriptions: [],
  path1: nil,
  path2: nil
)
  rsa = double("ResponsiveSearchAdInfo",
    headlines: headlines,
    descriptions: descriptions,
    path1: path1,
    path2: path2)

  ad = double("Ad",
    id: ad_id,
    final_urls: final_urls,
    responsive_search_ad: rsa)

  ad_group_ad = double("AdGroupAd",
    resource_name: "customers/#{customer_id}/adGroupAds/#{ad_group_id}~#{ad_id}",
    ad: ad,
    status: status,
    ad_group: "customers/#{customer_id}/adGroups/#{ad_group_id}")

  row = double("GoogleAdsRow", ad_group_ad: ad_group_ad)
  [row]
end

def mock_mutate_ad_group_ad_response(ad_id: 12345, ad_group_id: 999, customer_id: 456)
  result = double("MutateAdGroupAdResult",
    resource_name: "customers/#{customer_id}/adGroupAds/#{ad_group_id}~#{ad_id}")
  double("MutateAdGroupAdsResponse", results: [result])
end

def mock_ad_group_ad_resource
  double("AdGroupAd").tap do |aga|
    allow(aga).to receive(:ad_group=)
    allow(aga).to receive(:status=)
    allow(aga).to receive(:ad=)
  end
end

def mock_ad_resource
  double("Ad").tap do |ad|
    allow(ad).to receive(:final_urls).and_return([])
    allow(ad).to receive(:responsive_search_ad=)
  end
end

def mock_responsive_search_ad_info_resource
  double("ResponsiveSearchAdInfo").tap do |rsa|
    allow(rsa).to receive(:headlines).and_return([])
    allow(rsa).to receive(:descriptions).and_return([])
    allow(rsa).to receive(:path1=)
    allow(rsa).to receive(:path2=)
  end
end

def mock_ad_text_asset_resource
  double("AdTextAsset").tap do |asset|
    allow(asset).to receive(:text=)
    allow(asset).to receive(:pinned_field=)
  end
end
```

### 5. Syncer Spec (`spec/services/google_ads/ad_spec.rb`)

Follow the pattern from `keyword_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe GoogleAds::Ad do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, account: account, project: project) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }
  let(:ad_group) { create(:ad_group, campaign: campaign) }
  let(:ad) do
    ad = create(:ad, ad_group: ad_group, status: "draft", display_path_1: "Shop", display_path_2: "Now")
    create(:ad_headline, ad: ad, text: "Great Products", position: 0)
    create(:ad_headline, ad: ad, text: "Buy Today", position: 1)
    create(:ad_description, ad: ad, text: "Amazing deals on all products", position: 0)
    ad.reload
  end
  let(:ad_syncer) { described_class.new(ad) }

  before do
    mock_google_ads_client
    # Add ad_group_ad service to mock
    allow(@mock_client).to receive(:service).and_return(
      double("Services",
        customer: @mock_customer_service,
        google_ads: @mock_google_ads_service,
        ad_group_ad: @mock_ad_group_ad_service)
    )
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
    allow(ad_group).to receive(:google_ad_group_id).and_return(999)

    # Setup domain for final_urls
    create(:domain, website: website, domain: "test-site.launch10.ai")
  end

  describe '#local_resource' do
    it 'returns the ad passed to the syncer' do
      expect(ad_syncer.local_resource).to eq(ad)
    end
  end

  describe '#final_urls' do
    it 'returns the website domain as final URL' do
      expect(ad.final_urls).to eq(["https://test-site.launch10.ai"])
    end
  end

  describe '#sync' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    context 'when remote ad does not exist' do
      before do
        ad.platform_settings["google"] = {}
        ad.save!
      end

      it 'creates a new ad with headlines and descriptions' do
        created_ad_response = mock_search_response_with_ad_group_ad(
          ad_id: 12345,
          ad_group_id: 999,
          customer_id: 1234567890,
          status: :PAUSED,
          final_urls: ["https://test-site.launch10.ai"]
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response, created_ad_response)

        # Setup resource mocks
        mock_aga = mock_ad_group_ad_resource
        mock_ad_obj = mock_ad_resource
        mock_rsa = mock_responsive_search_ad_info_resource

        allow(@mock_resource).to receive(:ad).and_yield(mock_ad_obj).and_return(mock_ad_obj)
        allow(@mock_resource).to receive(:responsive_search_ad_info).and_yield(mock_rsa).and_return(mock_rsa)
        allow(@mock_resource).to receive(:ad_text_asset).and_yield(mock_ad_text_asset_resource).and_return(mock_ad_text_asset_resource)
        allow(mock_create_resource).to receive(:ad_group_ad).and_yield(mock_aga)

        mutate_response = mock_mutate_ad_group_ad_response(ad_id: 12345, ad_group_id: 999, customer_id: 1234567890)
        allow(@mock_ad_group_ad_service).to receive(:mutate_ad_group_ads)
          .and_return(mutate_response)

        result = ad_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.created?).to be true
        expect(ad_syncer.local_resource.google_ad_id).to eq(12345)
      end
    end
  end

  describe 'Ad model helper methods' do
    before do
      ad.platform_settings["google"] = { "ad_id" => "12345" }
      ad.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          ad_group_ad: @mock_ad_group_ad_service)
      )
    end

    describe '#google_synced?' do
      it 'delegates to the syncer' do
        ad_response = mock_search_response_with_ad_group_ad(
          ad_id: 12345,
          ad_group_id: 999,
          customer_id: 1234567890,
          status: :PAUSED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_response)

        expect(ad.google_synced?).to be true
      end
    end

    describe '#google_sync' do
      it 'syncs the ad' do
        ad_response = mock_search_response_with_ad_group_ad(
          ad_id: 12345,
          ad_group_id: 999,
          customer_id: 1234567890,
          status: :PAUSED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_response)

        result = ad.google_sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
      end
    end
  end
end
```

### 6. Model Spec Updates (`spec/models/ad_spec.rb`)

Add tests for the new methods:

```ruby
require 'rails_helper'

RSpec.describe Ad, type: :model do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, account: account, project: project) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }
  let(:ad_group) { create(:ad_group, campaign: campaign) }
  let(:ad) { create(:ad, ad_group: ad_group) }

  describe '#final_urls' do
    context 'when website has a domain' do
      before do
        create(:domain, website: website, domain: "example.launch10.ai")
      end

      it 'returns the domain as a URL' do
        expect(ad.final_urls).to eq(["https://example.launch10.ai"])
      end
    end

    context 'when website has no domain' do
      it 'returns empty array' do
        expect(ad.final_urls).to eq([])
      end
    end
  end

  describe 'associations' do
    it 'has many headlines' do
      headline = create(:ad_headline, ad: ad)
      expect(ad.headlines).to include(headline)
    end

    it 'has many descriptions' do
      description = create(:ad_description, ad: ad)
      expect(ad.descriptions).to include(description)
    end
  end
end
```

## Implementation Checklist

1. [ ] Update `Ad` model:
   - [ ] Add `include GoogleMappable`
   - [ ] Add `include GoogleSyncable`
   - [ ] Add `use_google_sync GoogleAds::Ad`
   - [ ] Add `after_google_sync` callback
   - [ ] Add `final_urls` method

2. [ ] Create `GoogleAds::Ad` syncer:
   - [ ] `fetch_remote` / `fetch_by_id`
   - [ ] `sync_result`
   - [ ] `sync` (delegates to create/update)
   - [ ] `create_ad` with headlines/descriptions
   - [ ] `update_ad` (status only, or recreate pattern)
   - [ ] Helper methods for building assets

3. [ ] Update `FieldMappings`:
   - [ ] Add `AD_FIELDS` constant
   - [ ] Update `self.for` method

4. [ ] Update `google_ads_mocks.rb`:
   - [ ] Add `@mock_ad_group_ad_service`
   - [ ] Add mock response helpers
   - [ ] Add mock resource helpers

5. [ ] Create specs:
   - [ ] `spec/services/google_ads/ad_spec.rb`
   - [ ] Update `spec/models/ad_spec.rb`

6. [ ] Domain factory (if not exists):
   - [ ] Ensure domain factory exists for testing

## Notes on Pinning Logic

The current `AdHeadline` model has a `position` field. The pinning logic should be:

- Position 0 → Pin to first position (HEADLINE_1 / DESCRIPTION_1)
- Position 1 → Pin to second position (HEADLINE_2 / DESCRIPTION_2)
- Position 2 → Pin to third position (HEADLINE_3 only)
- Higher positions → No pinning (Google optimizes placement)

This assumes that if you set position=0, you want that headline to always appear first. If the business logic differs (e.g., only pin if explicitly marked), you may need to add a `pinned` boolean column to `AdHeadline` and `AdDescription`.

## Complex Field Mappings

For headlines and descriptions, simple field mappings won't work well because:

1. They're nested arrays of objects
2. Each has text + optional pinned_field
3. Order matters

You have two options:

### Option A: Custom comparison in syncer

Override `build_comparisons` in `GoogleAds::Ad` to handle the complex structure.

### Option B: Serialize for comparison

Create methods like `headlines_signature` that produce comparable values:

```ruby
def headlines_signature
  headlines.order(:position).map { |h| { text: h.text, position: h.position } }
end
```

Then add to field mappings with a custom transform that produces the same format from Google's response.

## Running Tests

```bash
# Run specific specs
bundle exec rspec spec/services/google_ads/ad_spec.rb
bundle exec rspec spec/models/ad_spec.rb

# Run all Google Ads specs
bundle exec rspec spec/services/google_ads/

# Run with coverage
COVERAGE=true bundle exec rspec spec/services/google_ads/ad_spec.rb
```
