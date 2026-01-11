# Google Ads Sync Simplification Plan

## Goal

Replace the current 7-file abstraction maze with a **one-file-per-resource** architecture. No metaprogramming. No base classes. No TracePoint magic. Just code.

---

## File Structure

```
app/services/google_ads/
├── client.rb                    # Google API client + HTTP logging
├── sync_result.rb               # Simple result object
├── collection_sync_result.rb    # Wraps multiple results
└── resources/
    ├── ad_schedule.rb           # ~100 lines, everything in one place
    ├── location_target.rb
    ├── campaign.rb
    ├── ad_group.rb
    ├── ad.rb
    ├── keyword.rb
    ├── budget.rb
    ├── callout.rb
    └── structured_snippet.rb

spec/services/google_ads/
├── resources/
│   └── ad_schedule_spec.rb      # Unit tests + VCR integration in one file
└── vcr_cassettes/
    └── google_ads/resources/    # Organized cassettes
```

---

## Resource Template (~100 lines)

Every resource follows this structure. No FIELD_MAPPINGS hash. Just explicit methods.

```ruby
# app/services/google_ads/resources/ad_schedule.rb
module GoogleAds
  module Resources
    class AdSchedule
      DAY_MAP = {
        "Monday" => :MONDAY, "Tuesday" => :TUESDAY, "Wednesday" => :WEDNESDAY,
        "Thursday" => :THURSDAY, "Friday" => :FRIDAY,
        "Saturday" => :SATURDAY, "Sunday" => :SUNDAY
      }.freeze

      MINUTE_MAP = { 0 => :ZERO, 15 => :FIFTEEN, 30 => :THIRTY, 45 => :FORTY_FIVE }.freeze

      attr_reader :record

      def initialize(record)
        @record = record
      end

      # ═══════════════════════════════════════════════════════════════
      # PUBLIC INTERFACE (4 methods, that's it)
      # ═══════════════════════════════════════════════════════════════

      # WARNING: This method makes an API call via fetch.
      # Do not call in a loop - use Campaign#ad_schedules_synced? for batch checks.
      def synced?
        return true if record.always_on? && !record.google_criterion_id
        return false unless record.google_criterion_id

        remote = fetch
        remote && fields_match?(remote)
      end

      def sync
        return delete if record.always_on? && record.google_criterion_id
        return SyncResult.unchanged(:campaign_criterion, record.google_criterion_id) if synced?

        record.google_criterion_id ? recreate : create
      end

      def delete
        return SyncResult.not_found(:campaign_criterion) unless record.google_criterion_id

        remove_from_google
        record.update!(google_criterion_id: nil)
        SyncResult.deleted(:campaign_criterion)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        SyncResult.error(:campaign_criterion, e)
      end

      def fetch
        return nil unless record.google_criterion_id

        results = client.service.google_ads.search(
          customer_id: customer_id,
          query: fetch_query
        )
        results.first&.campaign_criterion
      end

      # ═══════════════════════════════════════════════════════════════
      # GOOGLE API OPERATIONS
      # ═══════════════════════════════════════════════════════════════

      private

      def create
        response = mutate([build_create_operation])
        save_criterion_id(response)
        SyncResult.created(:campaign_criterion, record.google_criterion_id)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        SyncResult.error(:campaign_criterion, e)
      end

      # Explicit delete-then-create. No fake transaction wrapper.
      # If delete succeeds but create fails, record correctly has no Google ID
      # and can be retried.
      def recreate
        remove_from_google
        record.update!(google_criterion_id: nil)

        response = mutate([build_create_operation])
        save_criterion_id(response)
        SyncResult.updated(:campaign_criterion, record.google_criterion_id)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        SyncResult.error(:campaign_criterion, e)
      end

      def remove_from_google
        mutate([client.operation.remove_resource.campaign_criterion(resource_name)])
      end

      def build_create_operation
        client.operation.create_resource.campaign_criterion do |cc|
          cc.campaign = campaign_resource_name
          cc.ad_schedule = client.resource.ad_schedule_info do |s|
            s.day_of_week = google_day_of_week
            s.start_hour = record.start_hour
            s.start_minute = google_start_minute
            s.end_hour = record.end_hour
            s.end_minute = google_end_minute
          end
          cc.bid_modifier = record.bid_modifier if record.bid_modifier.present?
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # FIELD TRANSFORMS (explicit methods, not a hash)
      # ═══════════════════════════════════════════════════════════════

      def google_day_of_week
        DAY_MAP[record.day_of_week]
      end

      def google_start_minute
        MINUTE_MAP[record.start_minute] || :ZERO
      end

      def google_end_minute
        MINUTE_MAP[record.end_minute] || :ZERO
      end

      def fields_match?(remote)
        s = remote.ad_schedule
        google_day_of_week == s.day_of_week &&
          record.start_hour == s.start_hour &&
          google_start_minute == s.start_minute &&
          record.end_hour == s.end_hour &&
          google_end_minute == s.end_minute &&
          bid_modifier_matches?(remote)
      end

      def bid_modifier_matches?(remote)
        local = record.bid_modifier || 1.0
        remote_val = remote.bid_modifier || 1.0
        (local - remote_val).abs < 0.001  # Float comparison tolerance
      end

      # ═══════════════════════════════════════════════════════════════
      # HELPERS
      # ═══════════════════════════════════════════════════════════════

      def mutate(operations)
        client.service.campaign_criterion.mutate_campaign_criteria(
          customer_id: customer_id,
          operations: operations
        )
      end

      def save_criterion_id(response)
        criterion_id = response.results.last.resource_name.split("~").last.to_i
        record.update!(google_criterion_id: criterion_id)
      end

      def client
        GoogleAds.client
      end

      def customer_id
        record.campaign.google_customer_id.to_s
      end

      def campaign_resource_name
        "customers/#{customer_id}/campaigns/#{record.campaign.google_campaign_id}"
      end

      def resource_name
        "customers/#{customer_id}/campaignCriteria/#{record.campaign.google_campaign_id}~#{record.google_criterion_id}"
      end

      def fetch_query
        <<~GAQL.squish
          SELECT
            campaign_criterion.criterion_id,
            campaign_criterion.ad_schedule.day_of_week,
            campaign_criterion.ad_schedule.start_hour,
            campaign_criterion.ad_schedule.start_minute,
            campaign_criterion.ad_schedule.end_hour,
            campaign_criterion.ad_schedule.end_minute,
            campaign_criterion.bid_modifier
          FROM campaign_criterion
          WHERE campaign_criterion.criterion_id = #{record.google_criterion_id}
            AND campaign_criterion.campaign = '#{campaign_resource_name}'
        GAQL
      end
    end
  end
end
```

**~110 lines. Everything in one place. No inheritance. No metaprogramming.**

---

## SyncResult: Simple Class Methods

```ruby
# app/services/google_ads/sync_result.rb
module GoogleAds
  class SyncResult
    attr_reader :resource_type, :resource_name, :action, :error

    def initialize(resource_type:, action:, resource_name: nil, error: nil)
      @resource_type = resource_type
      @action = action
      @resource_name = resource_name
      @error = error
    end

    def success?
      action != :error
    end

    def synced?
      %i[unchanged created updated deleted].include?(action)
    end

    def error?
      action == :error
    end

    # Factory methods
    class << self
      def created(type, id)
        new(resource_type: type, action: :created, resource_name: id)
      end

      def updated(type, id)
        new(resource_type: type, action: :updated, resource_name: id)
      end

      def deleted(type)
        new(resource_type: type, action: :deleted)
      end

      def unchanged(type, id)
        new(resource_type: type, action: :unchanged, resource_name: id)
      end

      def not_found(type)
        new(resource_type: type, action: :not_found)
      end

      def error(type, err)
        new(resource_type: type, action: :error, error: err)
      end
    end
  end
end
```

---

## CollectionSyncResult

```ruby
# app/services/google_ads/collection_sync_result.rb
module GoogleAds
  class CollectionSyncResult
    attr_reader :results

    def initialize(results)
      @results = results
    end

    def success?
      results.all?(&:success?)
    end

    def synced?
      results.all?(&:synced?)
    end

    def errors
      results.select(&:error?)
    end

    def created_count
      results.count { |r| r.action == :created }
    end

    def updated_count
      results.count { |r| r.action == :updated }
    end

    def deleted_count
      results.count { |r| r.action == :deleted }
    end

    def unchanged_count
      results.count { |r| r.action == :unchanged }
    end
  end
end
```

---

## Model Integration: Just 4 Methods

No concern. No metaprogramming. Just explicit delegation.

```ruby
# app/models/ad_schedule.rb
class AdSchedule < ApplicationRecord
  include PlatformSettings

  belongs_to :campaign

  platform_setting :google, :criterion_id

  # ═══════════════════════════════════════════════════════════════
  # GOOGLE SYNC (4 methods, explicit, no magic)
  # ═══════════════════════════════════════════════════════════════

  def google_sync
    GoogleAds::Resources::AdSchedule.new(self).sync
  end

  def google_synced?
    GoogleAds::Resources::AdSchedule.new(self).synced?
  end

  def google_delete
    GoogleAds::Resources::AdSchedule.new(self).delete
  end

  def google_fetch
    GoogleAds::Resources::AdSchedule.new(self).fetch
  end
end
```

---

## Collection Sync: Inline in Campaign

No base class. Just code you can read.

```ruby
# app/models/campaign.rb
class Campaign < ApplicationRecord
  # ... other stuff ...

  # ═══════════════════════════════════════════════════════════════
  # COLLECTION SYNC: AD SCHEDULES
  # ═══════════════════════════════════════════════════════════════

  def sync_ad_schedules
    results = []

    ad_schedules.only_deleted.each do |schedule|
      results << schedule.google_delete if schedule.google_criterion_id
    end

    ad_schedules.each do |schedule|
      results << schedule.google_sync
    end

    GoogleAds::CollectionSyncResult.new(results)
  end

  # Note: This checks local state only (no API calls).
  # For true remote verification, iterate with google_synced? (expensive).
  def ad_schedules_synced?
    ad_schedules.only_deleted.none? { |s| s.google_criterion_id.present? } &&
      ad_schedules.all? { |s| s.google_criterion_id.present? }
  end

  # ═══════════════════════════════════════════════════════════════
  # COLLECTION SYNC: LOCATION TARGETS (same pattern)
  # ═══════════════════════════════════════════════════════════════

  def sync_location_targets
    results = []

    location_targets.only_deleted.each do |target|
      results << target.google_delete if target.google_criterion_id
    end

    location_targets.each do |target|
      results << target.google_sync
    end

    GoogleAds::CollectionSyncResult.new(results)
  end

  def location_targets_synced?
    location_targets.only_deleted.none? { |t| t.google_criterion_id.present? } &&
      location_targets.all? { |t| t.google_criterion_id.present? }
  end

  # ... same pattern for callouts, structured_snippets, etc.
end
```

---

## Deploy Step Pattern (captures sync_result)

Deploy steps capture the return value for reporting/debugging:

```ruby
# In CampaignDeploy::STEPS
Step.define(:create_schedule) do
  def run
    @sync_result = campaign.sync_ad_schedules
  end

  def finished?
    campaign.ad_schedules_synced?
  end

  def sync_result
    @sync_result
  end
end
```

---

## HTTP Logging with Rotation

```ruby
# app/services/google_ads/client.rb
module GoogleAds
  class << self
    def client
      @client ||= build_client
    end

    def reset_client!
      @client = nil
    end

    def is_test_mode?
      ENV["GOOGLE_ADS_TEST_MODE"] == "true"
    end

    private

    def build_client
      Google::Ads::GoogleAds::GoogleAdsClient.new do |config|
        config.client_id = credentials[:client_id]
        config.client_secret = credentials[:client_secret]
        config.refresh_token = credentials[:refresh_token]
        config.developer_token = credentials[:developer_token]
        config.login_customer_id = credentials[:login_customer_id]

        config.logger = google_ads_logger
        config.log_level = log_level
      end
    end

    def google_ads_logger
      @google_ads_logger ||= if Rails.env.test?
        Logger.new(nil)  # /dev/null in test
      else
        Logger.new(
          Rails.root.join("log", "google_ads.log"),
          10,           # Keep 10 rotated files
          10.megabytes  # 10MB each
        )
      end
    end

    def log_level
      ENV.fetch("GOOGLE_ADS_LOG_LEVEL", "info").to_sym
    end

    def credentials
      Rails.application.credentials.google_ads
    end
  end
end
```

**Usage:**
```bash
# See all HTTP traffic
GOOGLE_ADS_LOG_LEVEL=debug bin/rails console

# Check logs (auto-rotates at 10MB, keeps 10 files)
tail -f log/google_ads.log
```

---

## Testing Strategy

### Unit + Integration Tests (one file per resource)

```ruby
# spec/services/google_ads/resources/ad_schedule_spec.rb
RSpec.describe GoogleAds::Resources::AdSchedule do
  let(:campaign) { create(:campaign, :with_google_ids) }
  let(:schedule) { create(:ad_schedule, campaign: campaign) }
  let(:resource) { described_class.new(schedule) }

  # ═══════════════════════════════════════════════════════════════
  # UNIT TESTS (mocked)
  # ═══════════════════════════════════════════════════════════════

  describe "#synced?" do
    context "when always_on and no criterion_id" do
      before { schedule.update!(always_on: true, google_criterion_id: nil) }

      it "returns true without API call" do
        expect(resource).not_to receive(:fetch)
        expect(resource.synced?).to be true
      end
    end

    context "when has criterion_id" do
      before { schedule.update!(google_criterion_id: 123) }

      it "fetches from Google and compares fields" do
        remote = double(
          ad_schedule: double(
            day_of_week: :MONDAY,
            start_hour: schedule.start_hour,
            start_minute: :ZERO,
            end_hour: schedule.end_hour,
            end_minute: :ZERO
          ),
          bid_modifier: 1.0
        )
        allow(resource).to receive(:fetch).and_return(remote)

        expect(resource.synced?).to be true
      end

      it "returns false when bid_modifier differs" do
        schedule.update!(bid_modifier: 1.5)
        remote = double(
          ad_schedule: double(
            day_of_week: :MONDAY,
            start_hour: schedule.start_hour,
            start_minute: :ZERO,
            end_hour: schedule.end_hour,
            end_minute: :ZERO
          ),
          bid_modifier: 1.0  # Different
        )
        allow(resource).to receive(:fetch).and_return(remote)

        expect(resource.synced?).to be false
      end
    end
  end

  describe "#sync" do
    it "creates in Google when no criterion_id" do
      mock_response = double(
        results: [double(resource_name: "customers/123/campaignCriteria/456~789")]
      )

      expect_any_instance_of(Google::Ads::GoogleAds::Services::CampaignCriterionService::Client)
        .to receive(:mutate_campaign_criteria)
        .and_return(mock_response)

      result = resource.sync

      expect(result.action).to eq(:created)
      expect(schedule.reload.google_criterion_id).to eq(789)
    end
  end

  describe "#recreate" do
    before { schedule.update!(google_criterion_id: 123) }

    it "deletes then creates (explicit state machine)" do
      allow(resource).to receive(:synced?).and_return(false)

      # Should make two separate calls, not one atomic call
      expect(resource).to receive(:remove_from_google).ordered
      expect(resource).to receive(:mutate).ordered.and_return(
        double(results: [double(resource_name: "customers/123/campaignCriteria/456~999")])
      )

      resource.send(:recreate)

      # After delete, ID should be nil, then set to new value
      expect(schedule.reload.google_criterion_id).to eq(999)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # VCR INTEGRATION TESTS
  # ═══════════════════════════════════════════════════════════════

  describe "integration", :vcr do
    let(:campaign) { create(:campaign, :deployed_to_google) }
    let(:schedule) { create(:ad_schedule, campaign: campaign, day_of_week: "Monday") }

    it "full lifecycle", vcr: { cassette_name: "google_ads/resources/ad_schedule/lifecycle" } do
      resource = described_class.new(schedule)

      # Create
      result = resource.sync
      expect(result).to be_success
      expect(result.action).to eq(:created)
      expect(schedule.google_criterion_id).to be_present

      # Fetch
      remote = resource.fetch
      expect(remote.ad_schedule.day_of_week).to eq(:MONDAY)

      # Verify synced
      expect(resource.synced?).to be true

      # Delete
      delete_result = resource.delete
      expect(delete_result.action).to eq(:deleted)
      expect(schedule.reload.google_criterion_id).to be_nil
    end
  end
end
```

### Deploy Step Tests

```ruby
# spec/models/campaign_deploy_spec.rb
RSpec.describe CampaignDeploy do
  describe "create_schedule step" do
    let(:campaign) { create(:campaign, :ready_for_schedule_step) }
    let(:runner) { CampaignDeploy::StepRunner.new(campaign) }

    before do
      create_list(:ad_schedule, 3, campaign: campaign)
    end

    it "syncs all ad schedules and captures result" do
      allow_any_instance_of(GoogleAds::Resources::AdSchedule)
        .to receive(:sync)
        .and_return(GoogleAds::SyncResult.created(:campaign_criterion, 123))

      step = runner.find(:create_schedule)
      step.run

      expect(step.finished?).to be true
      expect(step.sync_result).to be_a(GoogleAds::CollectionSyncResult)
      expect(step.sync_result.created_count).to eq(3)
    end
  end
end
```

---

## Migration Steps

### Phase 1: Build Foundation (keep old code running)

1. Create `app/services/google_ads/resources/` directory
2. Create `GoogleAds::SyncResult` with class methods
3. Create `GoogleAds::CollectionSyncResult`
4. Set up VCR for integration testing
5. Configure HTTP logging with rotation + test fallback

### Phase 2: Migrate AdSchedule (prove the pattern)

1. Create `GoogleAds::Resources::AdSchedule` (~110 lines)
2. Write full test suite (unit + VCR integration in one file)
3. Update `AdSchedule` model with 4 explicit methods
4. Update `Campaign#sync_ad_schedules` to use new code
5. Update deploy step to capture `sync_result`
6. Verify deploy step still works
7. Delete old `GoogleAds::AdSchedule` and `GoogleAds::AdSchedules`

### Phase 3: Migrate Remaining Resources (one at a time)

For each resource:
1. Create `GoogleAds::Resources::X` file
2. Write tests
3. Update model
4. Update Campaign collection sync if applicable
5. Delete old files

Order:
- LocationTarget
- Campaign
- Budget
- AdGroup
- Ad
- Keyword
- Callout
- StructuredSnippet

### Phase 4: Cleanup

1. Delete `GoogleAds::Sync::Syncable`
2. Delete `GoogleAds::Sync::CollectionSyncable`
3. Delete `GoogleSyncable` concern
4. Delete centralized `FieldMappings` module
5. Delete old `SyncResult` (replace with simplified version)
6. Update this documentation

---

## Before & After Comparison

### Files to Understand AdSchedule Sync

| Before | After |
|--------|-------|
| `concerns/google_syncable.rb` | `resources/ad_schedule.rb` |
| `sync/syncable.rb` | *(deleted)* |
| `sync/collection_syncable.rb` | *(deleted)* |
| `sync/field_mappings.rb` | *(deleted)* |
| `sync/field_comparison.rb` | *(deleted)* |
| `google_ads/ad_schedule.rb` | *(deleted)* |
| `google_ads/ad_schedules.rb` | *(deleted)* |
| **7 files** | **1 file** |

### Lines of Code per Resource

| Before | After |
|--------|-------|
| ~400 lines across files | ~110 lines in one file |

### Abstractions

| Before | After |
|--------|-------|
| 7 layers of abstraction | 0 layers |
| Base classes | None |
| Metaprogramming (`define_method`) | None |
| TracePoint magic | None |
| FIELD_MAPPINGS hash with lambdas | Explicit methods |

---

## What We Keep

| Keep | Why |
|------|-----|
| `SyncResult` | Good abstraction for outcomes (simplified with class methods) |
| `CollectionSyncResult` | Wraps multiple results with helper methods |
| `PlatformSettings` | Clean nested JSON access |
| `CampaignDeploy` steps | Clear orchestration |
| 4-method interface | `sync`, `synced?`, `delete`, `fetch` |

## What We Kill

| Kill | Why |
|------|-----|
| `GoogleSyncable` concern | Metaprogramming obscures what happens |
| `Sync::Syncable` base | Unnecessary abstraction |
| `Sync::CollectionSyncable` base | Just inline the loop |
| Collection syncer classes | Move to Campaign model |
| `local_resource` / `remote_resource` | Call it `record`, use raw API response |
| Centralized `FieldMappings` | Use explicit methods per resource |
| `FieldComparison` class | Inline the comparison |
| TracePoint contracts | Runtime catches missing methods anyway |
| Value object wrappers | Use raw Google API response |

---

## Success Criteria

1. **One file to understand any resource** - Open `resources/ad_schedule.rb`, see everything
2. **~110 lines per resource** - Readable in 2 minutes
3. **No base classes** - No inheritance to trace
4. **No metaprogramming** - No `define_method`, no TracePoint
5. **HTTP logging works** - `GOOGLE_ADS_LOG_LEVEL=debug`, check `log/google_ads.log`
6. **Deploy steps unchanged** - Same interface, simpler internals
7. **Tests in one file per resource** - Unit + VCR in same spec file
