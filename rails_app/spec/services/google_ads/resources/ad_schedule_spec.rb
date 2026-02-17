require 'rails_helper'

RSpec.describe GoogleAds::Resources::AdSchedule do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account) }
  let(:schedule) do
    create(:ad_schedule,
      campaign: campaign,
      day_of_week: "Monday",
      start_hour: 9,
      start_minute: 0,
      end_hour: 17,
      end_minute: 0)
  end
  let(:resource) { described_class.new(schedule) }

  before do
    mock_google_ads_client
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
    allow(campaign).to receive(:google_campaign_id).and_return(789)
  end

  # ═══════════════════════════════════════════════════════════════
  # #compare_fields
  # ═══════════════════════════════════════════════════════════════

  describe '#compare_fields' do
    it 'returns a FieldCompare instance' do
      remote = mock_remote_criterion(
        day_of_week: :MONDAY,
        start_hour: 9,
        start_minute: :ZERO,
        end_hour: 17,
        end_minute: :ZERO
      )

      result = resource.compare_fields(remote)
      expect(result).to be_a(GoogleAds::FieldCompare)
    end

    it 'matches when all fields are equal' do
      remote = mock_remote_criterion(
        day_of_week: :MONDAY,
        start_hour: 9,
        start_minute: :ZERO,
        end_hour: 17,
        end_minute: :ZERO
      )

      result = resource.compare_fields(remote)
      expect(result.match?).to be true
      expect(result.failures).to be_empty
    end

    it 'detects mismatched start_hour' do
      remote = mock_remote_criterion(
        day_of_week: :MONDAY,
        start_hour: 8,
        start_minute: :ZERO,
        end_hour: 17,
        end_minute: :ZERO
      )

      result = resource.compare_fields(remote)
      expect(result.match?).to be false
      expect(result.failures).to include(:start_hour)
    end

    it 'detects mismatched day_of_week' do
      remote = mock_remote_criterion(
        day_of_week: :TUESDAY,
        start_hour: 9,
        start_minute: :ZERO,
        end_hour: 17,
        end_minute: :ZERO
      )

      result = resource.compare_fields(remote)
      expect(result.match?).to be false
      expect(result.failures).to include(:day_of_week)
    end

    it 'provides debugging hash via to_h' do
      remote = mock_remote_criterion(
        day_of_week: :MONDAY,
        start_hour: 8,
        start_minute: :ZERO,
        end_hour: 17,
        end_minute: :ZERO
      )

      result = resource.compare_fields(remote)
      hash = result.to_h

      expect(hash[:start_hour][:local]).to eq(9)
      expect(hash[:start_hour][:remote]).to eq(8)
      expect(hash[:start_hour][:match]).to be false
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #to_google_json (FieldMappable)
  # ═══════════════════════════════════════════════════════════════

  describe '#to_google_json' do
    it 'transforms day_of_week to Google symbol' do
      schedule.day_of_week = "Tuesday"
      result = resource.to_google_json
      expect(result[:day_of_week]).to eq(:TUESDAY)
    end

    it 'transforms all days of the week' do
      days = {
        "Monday" => :MONDAY,
        "Tuesday" => :TUESDAY,
        "Wednesday" => :WEDNESDAY,
        "Thursday" => :THURSDAY,
        "Friday" => :FRIDAY,
        "Saturday" => :SATURDAY,
        "Sunday" => :SUNDAY
      }

      days.each do |local, remote|
        schedule.day_of_week = local
        # Clear memoized attrs
        resource.instance_variable_set(:@attrs, nil)
        expect(resource.to_google_json[:day_of_week]).to eq(remote)
      end
    end

    it 'keeps start_hour and end_hour as integers' do
      result = resource.to_google_json
      expect(result[:start_hour]).to eq(9)
      expect(result[:end_hour]).to eq(17)
    end

    it 'transforms start_minute to Google symbol' do
      schedule.start_minute = 15
      resource.instance_variable_set(:@attrs, nil)
      expect(resource.to_google_json[:start_minute]).to eq(:FIFTEEN)
    end

    it 'transforms end_minute to Google symbol' do
      schedule.end_minute = 30
      resource.instance_variable_set(:@attrs, nil)
      expect(resource.to_google_json[:end_minute]).to eq(:THIRTY)
    end

    it 'transforms all minute values' do
      minutes = { 0 => :ZERO, 15 => :FIFTEEN, 30 => :THIRTY, 45 => :FORTY_FIVE }

      minutes.each do |local, remote|
        schedule.start_minute = local
        schedule.end_minute = local
        resource.instance_variable_set(:@attrs, nil)
        result = resource.to_google_json
        expect(result[:start_minute]).to eq(remote)
        expect(result[:end_minute]).to eq(remote)
      end
    end

    it 'returns complete hash with all schedule fields' do
      result = resource.to_google_json
      expect(result.keys).to contain_exactly(:day_of_week, :start_hour, :start_minute, :end_hour, :end_minute)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #from_google_json (FieldMappable)
  # ═══════════════════════════════════════════════════════════════

  describe '#from_google_json' do
    it 'reverse transforms remote values to local format' do
      remote = mock_remote_criterion(
        day_of_week: :WEDNESDAY,
        start_hour: 10,
        start_minute: :THIRTY,
        end_hour: 18,
        end_minute: :FORTY_FIVE
      )

      result = resource.from_google_json(remote)

      expect(result[:day_of_week]).to eq("Wednesday")
      expect(result[:start_hour]).to eq(10)
      expect(result[:start_minute]).to eq(30)
      expect(result[:end_hour]).to eq(18)
      expect(result[:end_minute]).to eq(45)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #fetch
  # ═══════════════════════════════════════════════════════════════

  describe '#fetch' do
    context 'when no criterion_id exists' do
      it 'returns nil without making API call' do
        expect(@mock_google_ads_service).not_to receive(:search)
        expect(resource.fetch).to be_nil
      end
    end

    context 'when criterion_id exists' do
      before do
        schedule.platform_settings["google"] = { "criterion_id" => 222 }
        schedule.save!
      end

      it 'returns the remote criterion when found' do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = resource.fetch
        expect(result).not_to be_nil
        expect(result.ad_schedule.day_of_week).to eq(:MONDAY)
      end

      it 'returns nil when not found' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        expect(resource.fetch).to be_nil
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #synced?
  # ═══════════════════════════════════════════════════════════════

  describe '#synced?' do
    context 'when no criterion_id exists' do
      context "when schedule is always_on" do
        it 'returns true' do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

          campaign.update_ad_schedules(always_on: true)
          resource = described_class.new(campaign.ad_schedules.first)
          expect(resource.synced?).to be true
        end
      end

      context "when schedule isnt always_on" do
        it 'returns false when always_on is false but no schedules exist in Google' do
          schedule.update(always_on: false)
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

          expect(resource.synced?).to be false
        end
      end
    end

    context 'when criterion_id exists' do
      before do
        schedule.platform_settings["google"] = { "criterion_id" => 222 }
        schedule.save!
      end

      it 'returns true when remote matches local' do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(resource.synced?).to be true
      end

      it 'returns false when remote does not match local' do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :TUESDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(resource.synced?).to be false
      end

      it 'returns false when remote not found' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        expect(resource.synced?).to be false
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # SYNC RESULT (instance + class + campaign wrapper)
  # ═══════════════════════════════════════════════════════════════

  describe "#sync_result" do
    context "when no google_criterion_id" do
      it "returns not_found" do
        result = resource.sync_result
        expect(result.not_found?).to be true
      end
    end

    context "when google_criterion_id exists but remote not found" do
      before do
        schedule.update!(platform_settings: { "google" => { "criterion_id" => 111 } })
      end

      it "returns not_found" do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        result = resource.sync_result
        expect(result.not_found?).to be true
      end
    end

    context "when remote matches" do
      before do
        schedule.update!(platform_settings: { "google" => { "criterion_id" => 111 } })
      end

      it "returns unchanged" do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = resource.sync_result
        expect(result.unchanged?).to be true
        expect(result.resource_name).to eq(111)
      end
    end

    context "when remote does not match" do
      before do
        schedule.update!(platform_settings: { "google" => { "criterion_id" => 111 } })
      end

      it "returns error with SyncVerificationError" do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :TUESDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = resource.sync_result
        expect(result.error?).to be true
        expect(result.error).to be_a(GoogleAds::SyncVerificationError)
        expect(result.error.message).to include("Ad schedule sync verification failed")
      end
    end
  end

  describe ".sync_result" do
    it "returns a CollectionSyncResult" do
      schedule.update!(platform_settings: { "google" => { "criterion_id" => 111 } })

      criterion_response = mock_search_response_with_ad_schedule(
        criterion_id: 111,
        campaign_id: 789,
        customer_id: 1234567890,
        day_of_week: :MONDAY,
        start_hour: 9,
        start_minute: :ZERO,
        end_hour: 17,
        end_minute: :ZERO
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      result = described_class.sync_result(campaign)
      expect(result).to be_a(GoogleAds::Sync::CollectionSyncResult)
    end
  end

  describe "Campaign#ad_schedules_sync_result" do
    it "delegates to the resource class" do
      schedule.update!(platform_settings: { "google" => { "criterion_id" => 111 } })

      criterion_response = mock_search_response_with_ad_schedule(
        criterion_id: 111,
        campaign_id: 789,
        customer_id: 1234567890,
        day_of_week: :MONDAY,
        start_hour: 9,
        start_minute: :ZERO,
        end_hour: 17,
        end_minute: :ZERO
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      result = campaign.ad_schedules_sync_result
      expect(result).to be_a(GoogleAds::Sync::CollectionSyncResult)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #sync
  # ═══════════════════════════════════════════════════════════════

  describe '#sync' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    context 'when already synced' do
      before do
        schedule.platform_settings["google"] = { "criterion_id" => 222 }
        schedule.save!
      end

      it 'returns unchanged SyncResult without making mutate API call' do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(@mock_campaign_criterion_service).not_to receive(:mutate_campaign_criteria)

        result = resource.sync

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
        expect(result.synced?).to be true
        expect(result.resource_type).to eq(:campaign_criterion)
      end
    end

    context 'when no criterion exists (create)' do
      before do
        schedule.platform_settings["google"] = {}
        schedule.save!
      end

      it 'creates a new criterion and returns created SyncResult' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        mock_criterion = mock_campaign_criterion_with_ad_schedule_resource
        mock_ad_schedule_info = mock_ad_schedule_info_resource

        expect(mock_criterion).to receive(:campaign=).with("customers/1234567890/campaigns/789")
        expect(mock_criterion).to receive(:ad_schedule=).with(mock_ad_schedule_info)

        expect(mock_ad_schedule_info).to receive(:day_of_week=).with(:MONDAY)
        expect(mock_ad_schedule_info).to receive(:start_hour=).with(9)
        expect(mock_ad_schedule_info).to receive(:start_minute=).with(:ZERO)
        expect(mock_ad_schedule_info).to receive(:end_hour=).with(17)
        expect(mock_ad_schedule_info).to receive(:end_minute=).with(:ZERO)

        allow(@mock_resource).to receive(:ad_schedule_info).and_yield(mock_ad_schedule_info).and_return(mock_ad_schedule_info)
        allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 333, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(mutate_response)

        result = resource.sync

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.created?).to be true
        expect(result.synced?).to be true
        expect(result.resource_type).to eq(:campaign_criterion)
        expect(schedule.reload.google_criterion_id).to eq(333)
      end

      it 'returns error SyncResult when API call fails' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        mock_criterion = mock_campaign_criterion_with_ad_schedule_resource
        mock_ad_schedule_info = mock_ad_schedule_info_resource
        allow(@mock_resource).to receive(:ad_schedule_info).and_yield(mock_ad_schedule_info).and_return(mock_ad_schedule_info)
        allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_raise(mock_google_ads_error(message: "Ad schedule creation failed"))

        result = resource.sync

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.error?).to be true
        expect(result.synced?).to be false
      end
    end

    context 'when criterion exists but fields mismatch (recreate)' do
      before do
        schedule.platform_settings["google"] = { "criterion_id" => 222 }
        schedule.start_hour = 10
        schedule.save!
      end

      it 'deletes old criterion, creates new, and returns updated SyncResult' do
        mismatched_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(mismatched_response)

        mock_criterion = mock_campaign_criterion_with_ad_schedule_resource
        mock_ad_schedule_info = mock_ad_schedule_info_resource
        allow(@mock_resource).to receive(:ad_schedule_info).and_yield(mock_ad_schedule_info).and_return(mock_ad_schedule_info)
        allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~222")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 444, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(mutate_response)

        result = resource.sync

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.updated?).to be true
        expect(result.synced?).to be true
        expect(schedule.reload.google_criterion_id).to eq(444)
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #delete
  # ═══════════════════════════════════════════════════════════════

  describe '#delete' do
    context 'when no criterion_id exists' do
      before do
        schedule.platform_settings["google"] = {}
        schedule.save!
      end

      it 'returns not_found SyncResult' do
        result = resource.delete

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:campaign_criterion)
      end
    end

    context 'when criterion_id exists' do
      before do
        schedule.platform_settings["google"] = { "criterion_id" => 222 }
        schedule.save!
      end

      it 'deletes the criterion and returns deleted SyncResult' do
        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~222")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 222, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(mutate_response)

        result = resource.delete

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.deleted?).to be true
        expect(result.resource_type).to eq(:campaign_criterion)
        expect(schedule.reload.google_criterion_id).to be_nil
      end

      it 'persists nil criterion_id to the database' do
        schedule.destroy

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~222")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 222, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(mutate_response)

        resource.delete

        fresh_schedule = ::AdSchedule.with_deleted.find(schedule.id)
        expect(fresh_schedule.google_criterion_id).to be_nil
      end

      it 'returns error SyncResult when API call fails' do
        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~222")
          .and_return(mock_remove_operation)

        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_raise(mock_google_ads_error(message: "Criterion deletion failed"))

        result = resource.delete

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.error?).to be true
      end

      it 'handles case when Google no longer has the criterion' do
        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~222")
          .and_return(mock_remove_operation)

        # Google returns "criterion not found" error
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_raise(mock_google_ads_error(
            message: "Resource was not found",
            error_type: :criterion_error,
            error_value: :CANNOT_REMOVE_IF_NOT_TARGETED
          ))

        result = resource.delete

        # Could return error or handle gracefully - documenting current behavior
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.error?).to be true
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # always_on schedules
  #
  # CRITICAL: always_on means "we want ZERO schedules in Google"
  # synced? must ALWAYS verify against Google - cannot trust local state!
  # ═══════════════════════════════════════════════════════════════

  describe 'always_on schedules' do
    let(:always_on_schedule) do
      create(:ad_schedule, :always_on, campaign: campaign)
    end
    let(:always_on_resource) { described_class.new(always_on_schedule) }

    describe '#synced?' do
      # ─────────────────────────────────────────────────────────────
      # These tests verify that synced? ACTUALLY checks Google,
      # not just trusts local db_schedule.google_criterion_id
      # ─────────────────────────────────────────────────────────────

      context 'when Google has NO schedules for this campaign (truly synced)' do
        it 'returns true AFTER verifying against Google API' do
          # Mock: Google returns empty when querying all ad schedules for campaign
          allow(@mock_google_ads_service).to receive(:search)
            .with(hash_including(
              customer_id: "1234567890",
              query: match(/AD_SCHEDULE/)
            ))
            .and_return(mock_empty_search_response)

          expect(always_on_resource.synced?).to be true
        end
      end

      context 'when Google has schedules we do NOT know about (NOT synced!)' do
        # CRITICAL TEST: This exposes the bug where we trust local state
        # Local: always_on=true, criterion_id=nil (we think we're clean)
        # Google: actually has schedules 888, 999 (reality differs!)

        it 'returns false because Google has schedules that should not exist' do
          # Mock: Google returns schedules even though our local criterion_id is nil
          schedule_response = mock_search_response_with_ad_schedule_criteria(
            [888, 999],
            campaign_id: 789,
            customer_id: 1234567890
          )
          allow(@mock_google_ads_service).to receive(:search)
            .with(hash_including(
              customer_id: "1234567890",
              query: match(/AD_SCHEDULE/)
            ))
            .and_return(schedule_response)

          # This MUST return false - Google has schedules!
          expect(always_on_resource.synced?).to be false
        end
      end

      context 'when Google has a schedule we know about (stale criterion)' do
        before do
          always_on_schedule.platform_settings["google"] = { "criterion_id" => 999 }
          always_on_schedule.save!
        end

        it 'returns false because stale criterion needs deletion' do
          # The CORRECT implementation queries all schedules for the campaign
          # The BROKEN implementation uses fetch (specific criterion query)
          # We mock both to ensure test works regardless of implementation path
          schedule_response = mock_search_response_with_ad_schedule_criteria(
            [999],
            campaign_id: 789,
            customer_id: 1234567890
          )
          # Mock both the "all schedules" query and the "specific criterion" query
          allow(@mock_google_ads_service).to receive(:search).and_return(schedule_response)

          expect(always_on_resource.synced?).to be false
        end
      end

      context 'when API error occurs during any_schedules_exist_in_google? check' do
        # NOTE: This test documents expected behavior - when Google check fails,
        # we should NOT assume we're synced. Could raise or return false.
        it 'raises or returns false (does NOT assume synced)' do
          allow(@mock_google_ads_service).to receive(:search)
            .with(hash_including(
              customer_id: "1234567890",
              query: match(/AD_SCHEDULE/)
            ))
            .and_raise(mock_google_ads_error(message: "Search failed"))

          # Option A: raises (conservative - surface the error)
          # Option B: returns false (fail-safe - assume not synced)
          # Implementation should choose one - test documents behavior
          expect {
            always_on_resource.synced?
          }.to raise_error(Google::Ads::GoogleAds::Errors::GoogleAdsError)
        end
      end
    end

    # ─────────────────────────────────────────────────────────────
    # #delete for always_on schedules
    #
    # QUESTION: Should delete for always_on behave differently?
    # Option A: delete only removes known criterion (current behavior)
    # Option B: delete removes ALL schedules in Google (more correct?)
    #
    # Currently documenting Option A behavior. If you change to Option B,
    # update these tests accordingly.
    # ─────────────────────────────────────────────────────────────

    describe '#delete' do
      context 'when no criterion_id exists locally' do
        it 'returns not_found even if Google has schedules' do
          # This is arguably a bug - we're not checking Google!
          # But delete is meant for explicit deletion, not sync
          # The sync method should handle cleanup
          result = always_on_resource.delete

          expect(result).to be_a(GoogleAds::SyncResult)
          expect(result.not_found?).to be true
        end
      end

      context 'when criterion_id exists locally' do
        before do
          always_on_schedule.platform_settings["google"] = { "criterion_id" => 999 }
          always_on_schedule.save!
        end

        it 'deletes only the known criterion (does NOT check for others)' do
          # NOTE: This test documents current behavior
          # For always_on, sync should handle finding ALL schedules
          mock_remove_operation = double("RemoveOperation")
          allow(@mock_remove_resource).to receive(:campaign_criterion)
            .with("customers/1234567890/campaignCriteria/789~999")
            .and_return(mock_remove_operation)

          mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 999, campaign_id: 789, customer_id: 1234567890)
          allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(mutate_response)

          result = always_on_resource.delete

          expect(result).to be_a(GoogleAds::SyncResult)
          expect(result.deleted?).to be true
          expect(always_on_schedule.reload.google_criterion_id).to be_nil
        end
      end
    end

    describe '#sync' do
      context 'when Google has NO schedules (already synced)' do
        it 'returns unchanged SyncResult without making mutate API calls' do
          # Mock: Google confirms no schedules exist
          allow(@mock_google_ads_service).to receive(:search)
            .with(hash_including(
              customer_id: "1234567890",
              query: match(/AD_SCHEDULE/)
            ))
            .and_return(mock_empty_search_response)

          expect(@mock_campaign_criterion_service).not_to receive(:mutate_campaign_criteria)

          result = always_on_resource.sync

          expect(result).to be_a(GoogleAds::SyncResult)
          expect(result.unchanged?).to be true
          expect(result.synced?).to be true
        end
      end

      context 'when Google has unknown schedules we need to delete' do
        # CRITICAL: This tests that sync deletes schedules we didn't know about
        it 'deletes ALL schedules in Google to achieve always-on state' do
          # Mock: Google has schedules 888, 999 that we don't have locally
          schedule_response = mock_search_response_with_ad_schedule_criteria(
            [888, 999],
            campaign_id: 789,
            customer_id: 1234567890
          )
          allow(@mock_google_ads_service).to receive(:search)
            .with(hash_including(
              customer_id: "1234567890",
              query: match(/AD_SCHEDULE/)
            ))
            .and_return(schedule_response)

          # Expect deletion operations for BOTH unknown criteria
          mock_remove_op_888 = double("RemoveOperation888")
          mock_remove_op_999 = double("RemoveOperation999")
          allow(@mock_remove_resource).to receive(:campaign_criterion)
            .with("customers/1234567890/campaignCriteria/789~888")
            .and_return(mock_remove_op_888)
          allow(@mock_remove_resource).to receive(:campaign_criterion)
            .with("customers/1234567890/campaignCriteria/789~999")
            .and_return(mock_remove_op_999)

          mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 888, campaign_id: 789, customer_id: 1234567890)
          allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(mutate_response)

          result = always_on_resource.sync

          expect(result).to be_a(GoogleAds::SyncResult)
          expect(result.deleted?).to be true
        end
      end

      context 'when Google has known stale criterion (we have criterion_id locally)' do
        before do
          always_on_schedule.platform_settings["google"] = { "criterion_id" => 999 }
          always_on_schedule.save!
        end

        it 'deletes the stale criterion to achieve always-on state' do
          # Mock: Google confirms the criterion exists
          schedule_response = mock_search_response_with_ad_schedule_criteria(
            [999],
            campaign_id: 789,
            customer_id: 1234567890
          )
          allow(@mock_google_ads_service).to receive(:search)
            .with(hash_including(
              customer_id: "1234567890",
              query: match(/AD_SCHEDULE/)
            ))
            .and_return(schedule_response)

          mock_remove_operation = double("RemoveOperation")
          allow(@mock_remove_resource).to receive(:campaign_criterion)
            .with("customers/1234567890/campaignCriteria/789~999")
            .and_return(mock_remove_operation)

          mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 999, campaign_id: 789, customer_id: 1234567890)
          allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(mutate_response)

          result = always_on_resource.sync

          expect(result).to be_a(GoogleAds::SyncResult)
          expect(result.deleted?).to be true
          expect(always_on_schedule.reload.google_criterion_id).to be_nil
        end
      end

      context 'when API error occurs during any_schedules_exist_in_google? check' do
        it 'returns error SyncResult' do
          allow(@mock_google_ads_service).to receive(:search)
            .with(hash_including(
              customer_id: "1234567890",
              query: match(/AD_SCHEDULE/)
            ))
            .and_raise(mock_google_ads_error(message: "Search failed"))

          result = always_on_resource.sync

          expect(result).to be_a(GoogleAds::SyncResult)
          expect(result.error?).to be true
        end
      end

      context 'when batch deletion partially fails' do
        it 'returns error SyncResult when mutate fails' do
          # Mock: Google has schedules 888, 999
          schedule_response = mock_search_response_with_ad_schedule_criteria(
            [888, 999],
            campaign_id: 789,
            customer_id: 1234567890
          )
          allow(@mock_google_ads_service).to receive(:search)
            .with(hash_including(
              customer_id: "1234567890",
              query: match(/AD_SCHEDULE/)
            ))
            .and_return(schedule_response)

          mock_remove_op_888 = double("RemoveOperation888")
          mock_remove_op_999 = double("RemoveOperation999")
          allow(@mock_remove_resource).to receive(:campaign_criterion)
            .with("customers/1234567890/campaignCriteria/789~888")
            .and_return(mock_remove_op_888)
          allow(@mock_remove_resource).to receive(:campaign_criterion)
            .with("customers/1234567890/campaignCriteria/789~999")
            .and_return(mock_remove_op_999)

          # Mutate call fails
          allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
            .and_raise(mock_google_ads_error(message: "Partial operation failed"))

          result = always_on_resource.sync

          expect(result).to be_a(GoogleAds::SyncResult)
          expect(result.error?).to be true
        end
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # Model helper methods integration
  # ═══════════════════════════════════════════════════════════════

  describe 'AdSchedule model helper methods' do
    before do
      schedule.platform_settings["google"] = { "criterion_id" => 222 }
      schedule.save!
    end

    describe '#google_synced?' do
      it 'delegates to the resource' do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(schedule.google_synced?).to be true
      end
    end

    describe '#google_sync' do
      it 'syncs and returns SyncResult' do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = schedule.google_sync

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.synced?).to be true
      end
    end

    describe '#google_delete' do
      it 'deletes and returns SyncResult' do
        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~222")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 222, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(mutate_response)

        result = schedule.google_delete

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.deleted?).to be true
      end
    end

    describe '#google_fetch' do
      it 'fetches and returns remote criterion' do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = schedule.google_fetch

        expect(result).not_to be_nil
        expect(result.ad_schedule.day_of_week).to eq(:MONDAY)
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #sync_plan - dry run planning
  #
  # Returns a Plan showing what sync() WOULD do without executing
  # ═══════════════════════════════════════════════════════════════

  describe '#sync_plan' do
    describe 'specific schedules (not always_on)' do
      context 'when already synced' do
        before do
          schedule.platform_settings["google"] = { "criterion_id" => 222 }
          schedule.save!
        end

        it 'returns plan with unchanged operation' do
          criterion_response = mock_search_response_with_ad_schedule(
            criterion_id: 222,
            campaign_id: 789,
            customer_id: 1234567890,
            day_of_week: :MONDAY,
            start_hour: 9,
            start_minute: :ZERO,
            end_hour: 17,
            end_minute: :ZERO
          )
          allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

          plan = resource.sync_plan

          expect(plan).to be_a(GoogleAds::Sync::Plan)
          expect(plan.any_changes?).to be false
          expect(plan.unchanged.size).to eq(1)
          expect(plan.unchanged.first[:record]).to eq(schedule)
        end
      end

      context 'when no criterion_id exists (needs create)' do
        before do
          schedule.platform_settings["google"] = {}
          schedule.save!
        end

        it 'returns plan with create operation' do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

          plan = resource.sync_plan

          expect(plan).to be_a(GoogleAds::Sync::Plan)
          expect(plan.any_changes?).to be true
          expect(plan.creates.size).to eq(1)
          expect(plan.creates.first[:action]).to eq(:create)
          expect(plan.creates.first[:record]).to eq(schedule)
        end
      end

      context 'when criterion_id exists but fields mismatch (needs update/recreate)' do
        before do
          schedule.platform_settings["google"] = { "criterion_id" => 222 }
          schedule.start_hour = 10  # Changed from 9 to 10
          schedule.save!
        end

        it 'returns plan with update operation' do
          # Mock Google returning the old values (mismatch)
          criterion_response = mock_search_response_with_ad_schedule(
            criterion_id: 222,
            campaign_id: 789,
            customer_id: 1234567890,
            day_of_week: :MONDAY,
            start_hour: 9,  # Google has 9, local has 10
            start_minute: :ZERO,
            end_hour: 17,
            end_minute: :ZERO
          )
          allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

          plan = resource.sync_plan

          expect(plan).to be_a(GoogleAds::Sync::Plan)
          expect(plan.any_changes?).to be true
          expect(plan.updates.size).to eq(1)
          expect(plan.updates.first[:action]).to eq(:update)
          expect(plan.updates.first[:record]).to eq(schedule)
          expect(plan.updates.first[:reason]).to eq(:fields_mismatch)
        end
      end

      context 'when criterion_id exists but Google does not have it' do
        before do
          schedule.platform_settings["google"] = { "criterion_id" => 222 }
          schedule.save!
        end

        it 'returns plan with update operation (recreate needed)' do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

          plan = resource.sync_plan

          expect(plan).to be_a(GoogleAds::Sync::Plan)
          expect(plan.any_changes?).to be true
          expect(plan.updates.size).to eq(1)
          expect(plan.updates.first[:reason]).to eq(:missing_in_google)
        end
      end
    end

    describe 'always_on schedules' do
      let(:always_on_schedule) { create(:ad_schedule, :always_on, campaign: campaign) }
      let(:always_on_resource) { described_class.new(always_on_schedule) }

      context 'when Google has NO schedules (already synced)' do
        it 'returns plan with unchanged operation' do
          allow(@mock_google_ads_service).to receive(:search)
            .with(hash_including(query: match(/AD_SCHEDULE/)))
            .and_return(mock_empty_search_response)

          plan = always_on_resource.sync_plan

          expect(plan).to be_a(GoogleAds::Sync::Plan)
          expect(plan.any_changes?).to be false
          expect(plan.unchanged.size).to eq(1)
          expect(plan.unchanged.first[:record]).to eq(always_on_schedule)
        end
      end

      context 'when Google has schedules that need deletion' do
        it 'returns plan with delete operations for ALL Google schedules' do
          schedule_response = mock_search_response_with_ad_schedule_criteria(
            [888, 999],
            campaign_id: 789,
            customer_id: 1234567890
          )
          allow(@mock_google_ads_service).to receive(:search)
            .with(hash_including(query: match(/AD_SCHEDULE/)))
            .and_return(schedule_response)

          plan = always_on_resource.sync_plan

          expect(plan).to be_a(GoogleAds::Sync::Plan)
          expect(plan.any_changes?).to be true
          expect(plan.deletes.size).to eq(2)
          expect(plan.deletes.map { |d| d[:criterion_id] }).to match_array([888, 999])
        end
      end

      context 'when API error occurs during check' do
        it 'raises the error (cannot plan without knowing Google state)' do
          allow(@mock_google_ads_service).to receive(:search)
            .with(hash_including(query: match(/AD_SCHEDULE/)))
            .and_raise(mock_google_ads_error(message: "Search failed"))

          expect {
            always_on_resource.sync_plan
          }.to raise_error(Google::Ads::GoogleAds::Errors::GoogleAdsError)
        end
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # CLASS METHODS - Collection Operations
  #
  # These operate on all ad_schedules for a campaign
  # ═══════════════════════════════════════════════════════════════

  describe '.sync_plan' do
    # ═══════════════════════════════════════════════════════════════
    # Complex scenario: User changes schedule configuration
    #
    # BEFORE: Tuesday 9-5, Wednesday 9-5 (both synced to Google)
    # AFTER:  Monday 8-6, Wednesday 8-6
    #
    # Expected operations:
    # - DELETE Tuesday (soft-deleted, has google_criterion_id)
    # - UPDATE Wednesday (fields changed: 9-5 → 8-6)
    # - CREATE Monday (new record, no google_criterion_id)
    # ═══════════════════════════════════════════════════════════════

    context 'when switching from Tue/Wed 9-5 to Mon/Wed 8-6' do
      let!(:tuesday_schedule) do
        create(:ad_schedule,
          campaign: campaign,
          day_of_week: "Tuesday",
          start_hour: 9, start_minute: 0,
          end_hour: 17, end_minute: 0).tap do |s|
          s.update_column(:platform_settings, { "google" => { "criterion_id" => 111 } })
        end
      end

      let!(:wednesday_schedule) do
        create(:ad_schedule,
          campaign: campaign,
          day_of_week: "Wednesday",
          start_hour: 9, start_minute: 0,
          end_hour: 17, end_minute: 0).tap do |s|
          s.update_column(:platform_settings, { "google" => { "criterion_id" => 222 } })
        end
      end

      before do
        # Simulate user changing the schedule:
        # 1. Soft-delete Tuesday
        tuesday_schedule.destroy

        # 2. Update Wednesday times (9-5 → 8-6)
        wednesday_schedule.update!(start_hour: 8, end_hour: 18)

        # 3. Create Monday (new)
        @monday_schedule = create(:ad_schedule,
          campaign: campaign,
          day_of_week: "Monday",
          start_hour: 8, start_minute: 0,
          end_hour: 18, end_minute: 0)

        # Mock Google responses for the schedules that exist
        # Wednesday: Google still has old times (9-5), so it's a mismatch
        wednesday_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :WEDNESDAY,
          start_hour: 9,  # Google has 9, local has 8 → mismatch
          start_minute: :ZERO,
          end_hour: 17,   # Google has 17, local has 18 → mismatch
          end_minute: :ZERO
        )

        # Monday: no criterion_id, so fetch won't be called
        # Tuesday: soft-deleted, won't be fetched

        allow(@mock_google_ads_service).to receive(:search)
          .with(hash_including(query: match(/criterion_id = 222/)))
          .and_return(wednesday_response)
      end

      it 'returns a plan with 1 delete, 1 update, 1 create' do
        plan = described_class.sync_plan(campaign)

        expect(plan).to be_a(GoogleAds::Sync::Plan)
        expect(plan.any_changes?).to be true

        # Verify counts
        expect(plan.deletes.size).to eq(1)
        expect(plan.updates.size).to eq(1)
        expect(plan.creates.size).to eq(1)
      end

      it 'plans deletion of Tuesday (soft-deleted with google_criterion_id)' do
        plan = described_class.sync_plan(campaign)

        delete_op = plan.deletes.first
        expect(delete_op[:action]).to eq(:delete)
        expect(delete_op[:record].day_of_week).to eq("Tuesday")
        expect(delete_op[:criterion_id]).to eq(111)
      end

      it 'plans update of Wednesday (fields mismatch)' do
        plan = described_class.sync_plan(campaign)

        update_op = plan.updates.first
        expect(update_op[:action]).to eq(:update)
        expect(update_op[:record].day_of_week).to eq("Wednesday")
        expect(update_op[:reason]).to eq(:fields_mismatch)
      end

      it 'plans creation of Monday (new record)' do
        plan = described_class.sync_plan(campaign)

        create_op = plan.creates.first
        expect(create_op[:action]).to eq(:create)
        expect(create_op[:record].day_of_week).to eq("Monday")
      end
    end

    context 'when all schedules are already synced' do
      let!(:monday_schedule) do
        create(:ad_schedule,
          campaign: campaign,
          day_of_week: "Monday",
          start_hour: 9, start_minute: 0,
          end_hour: 17, end_minute: 0).tap do |s|
          s.update_column(:platform_settings, { "google" => { "criterion_id" => 333 } })
        end
      end

      before do
        # Mock Google returning matching values
        monday_response = mock_search_response_with_ad_schedule(
          criterion_id: 333,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )

        allow(@mock_google_ads_service).to receive(:search)
          .with(hash_including(query: match(/criterion_id = 333/)))
          .and_return(monday_response)
      end

      it 'returns a plan with no changes' do
        plan = described_class.sync_plan(campaign)

        expect(plan).to be_a(GoogleAds::Sync::Plan)
        expect(plan.any_changes?).to be false
        expect(plan.unchanged.size).to eq(1)
      end
    end

    context 'when soft-deleted record has no google_criterion_id' do
      let!(:schedule) do
        create(:ad_schedule,
          campaign: campaign,
          day_of_week: "Monday",
          start_hour: 9, start_minute: 0,
          end_hour: 17, end_minute: 0)
        # No google_criterion_id set
      end

      before do
        schedule.destroy  # Soft delete
      end

      it 'does not include delete operation (nothing to delete in Google)' do
        plan = described_class.sync_plan(campaign)

        expect(plan.deletes).to be_empty
        expect(plan.empty?).to be true
      end
    end

    context 'when switching to always_on' do
      let!(:monday_schedule) do
        create(:ad_schedule,
          campaign: campaign,
          day_of_week: "Monday",
          start_hour: 9, start_minute: 0,
          end_hour: 17, end_minute: 0).tap do |s|
          s.update_column(:platform_settings, { "google" => { "criterion_id" => 444 } })
        end
      end

      before do
        # Soft-delete specific schedule
        monday_schedule.destroy

        # Create always_on schedule
        @always_on = create(:ad_schedule, :always_on, campaign: campaign)

        # Mock: Google has the Monday schedule (444) and maybe others
        schedule_response = mock_search_response_with_ad_schedule_criteria(
          [444, 555],  # Google has criterion 444 (our Monday) plus an unknown 555
          campaign_id: 789,
          customer_id: 1234567890
        )
        allow(@mock_google_ads_service).to receive(:search)
          .with(hash_including(query: match(/AD_SCHEDULE/)))
          .and_return(schedule_response)
      end

      it 'plans deletion of soft-deleted record AND all Google schedules for always_on' do
        plan = described_class.sync_plan(campaign)

        expect(plan.any_changes?).to be true

        # Soft-deleted Monday needs deletion
        soft_delete_op = plan.deletes.find { |d| d[:record]&.day_of_week == "Monday" }
        expect(soft_delete_op).to be_present
        expect(soft_delete_op[:criterion_id]).to eq(444)

        # always_on also plans deletion of all Google schedules (444, 555)
        always_on_deletes = plan.deletes.select { |d| d[:criterion_id].present? && d[:record].nil? }
        expect(always_on_deletes.map { |d| d[:criterion_id] }).to include(444, 555)
      end
    end
  end

  describe '.sync_all' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    context 'when soft-deleted record has google_criterion_id' do
      let!(:deleted_schedule) do
        create(:ad_schedule,
          campaign: campaign,
          day_of_week: "Tuesday",
          start_hour: 9, start_minute: 0,
          end_hour: 17, end_minute: 0).tap do |s|
          s.update_column(:platform_settings, { "google" => { "criterion_id" => 111 } })
          s.destroy  # Soft delete
        end
      end

      it 'deletes the soft-deleted record from Google' do
        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~111")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(mutate_response)

        result = described_class.sync_all(campaign)

        expect(result).to be_a(GoogleAds::Sync::CollectionSyncResult)
        expect(result.results.any?(&:deleted?)).to be true
      end
    end

    context 'when active records need syncing' do
      let!(:new_schedule) do
        create(:ad_schedule,
          campaign: campaign,
          day_of_week: "Monday",
          start_hour: 9, start_minute: 0,
          end_hour: 17, end_minute: 0)
        # No google_criterion_id - needs creation
      end

      it 'syncs active records and returns CollectionSyncResult' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        mock_criterion = mock_campaign_criterion_with_ad_schedule_resource
        mock_ad_schedule_info = mock_ad_schedule_info_resource
        allow(@mock_resource).to receive(:ad_schedule_info).and_yield(mock_ad_schedule_info).and_return(mock_ad_schedule_info)
        allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 333, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(mutate_response)

        result = described_class.sync_all(campaign)

        expect(result).to be_a(GoogleAds::Sync::CollectionSyncResult)
        expect(result.results.any?(&:created?)).to be true
      end
    end

    context 'when combining delete and sync operations' do
      let!(:deleted_schedule) do
        create(:ad_schedule,
          campaign: campaign,
          day_of_week: "Tuesday",
          start_hour: 9, start_minute: 0,
          end_hour: 17, end_minute: 0).tap do |s|
          s.update_column(:platform_settings, { "google" => { "criterion_id" => 111 } })
          s.destroy
        end
      end

      let!(:new_schedule) do
        create(:ad_schedule,
          campaign: campaign,
          day_of_week: "Monday",
          start_hour: 9, start_minute: 0,
          end_hour: 17, end_minute: 0)
      end

      it 'handles both deletions and creates in correct order' do
        # Mock delete operation
        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~111")
          .and_return(mock_remove_operation)

        # Mock create operation
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        mock_criterion = mock_campaign_criterion_with_ad_schedule_resource
        mock_ad_schedule_info = mock_ad_schedule_info_resource
        allow(@mock_resource).to receive(:ad_schedule_info).and_yield(mock_ad_schedule_info).and_return(mock_ad_schedule_info)
        allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 333, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(mutate_response)

        result = described_class.sync_all(campaign)

        expect(result).to be_a(GoogleAds::Sync::CollectionSyncResult)
        expect(result.results.size).to eq(2)
      end
    end
  end

  private

  def mock_remote_criterion(day_of_week:, start_hour:, start_minute:, end_hour:, end_minute:)
    ad_schedule = double("AdScheduleInfo",
      day_of_week: day_of_week,
      start_hour: start_hour,
      start_minute: start_minute,
      end_hour: end_hour,
      end_minute: end_minute)

    double("CampaignCriterion",
      ad_schedule: ad_schedule)
  end
end
