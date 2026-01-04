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
      end_minute: 0,
      bid_modifier: 1.5)
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
        end_minute: :ZERO,
        bid_modifier: 1.5
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
        end_minute: :ZERO,
        bid_modifier: 1.5
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
        end_minute: :ZERO,
        bid_modifier: 1.5
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
        end_minute: :ZERO,
        bid_modifier: 1.5
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
        end_minute: :ZERO,
        bid_modifier: 1.5
      )

      result = resource.compare_fields(remote)
      hash = result.to_h

      expect(hash[:start_hour][:local]).to eq(9)
      expect(hash[:start_hour][:remote]).to eq(8)
      expect(hash[:start_hour][:match]).to be false
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
      it 'returns false' do
        expect(resource.synced?).to be false
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
          end_minute: :ZERO,
          bid_modifier: 1.5
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
          end_minute: :ZERO,
          bid_modifier: 1.5
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
        expect(mock_criterion).to receive(:bid_modifier=).with(1.5)

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
        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~222")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 222, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(mutate_response)

        resource.delete

        fresh_schedule = ::AdSchedule.find(schedule.id)
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
          end_minute: :ZERO,
          bid_modifier: 1.5
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
          end_minute: :ZERO,
          bid_modifier: 1.5
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

  private

  def mock_remote_criterion(day_of_week:, start_hour:, start_minute:, end_hour:, end_minute:, bid_modifier:)
    ad_schedule = double("AdScheduleInfo",
      day_of_week: day_of_week,
      start_hour: start_hour,
      start_minute: start_minute,
      end_hour: end_hour,
      end_minute: end_minute)

    double("CampaignCriterion",
      ad_schedule: ad_schedule,
      bid_modifier: bid_modifier)
  end
end
