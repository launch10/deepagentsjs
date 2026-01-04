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
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # always_on schedules
  # ═══════════════════════════════════════════════════════════════

  describe 'always_on schedules' do
    let(:always_on_schedule) do
      create(:ad_schedule, :always_on, campaign: campaign)
    end
    let(:always_on_resource) { described_class.new(always_on_schedule) }

    describe '#synced?' do
      context 'when always_on and no criterion_id exists' do
        it 'returns true (no schedules in Google = always on)' do
          expect(always_on_resource.synced?).to be true
        end
      end

      context 'when always_on but stale criterion_id exists' do
        before do
          always_on_schedule.platform_settings["google"] = { "criterion_id" => 999 }
          always_on_schedule.save!
        end

        it 'returns false (criterion should be deleted)' do
          criterion_response = mock_search_response_with_ad_schedule(
            criterion_id: 999,
            campaign_id: 789,
            customer_id: 1234567890,
            day_of_week: :MONDAY,
            start_hour: 9,
            start_minute: :ZERO,
            end_hour: 17,
            end_minute: :ZERO
          )
          allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

          expect(always_on_resource.synced?).to be false
        end
      end
    end

    describe '#sync' do
      context 'when always_on and no criterion_id exists' do
        it 'returns unchanged SyncResult without making API calls' do
          expect(@mock_campaign_criterion_service).not_to receive(:mutate_campaign_criteria)

          result = always_on_resource.sync

          expect(result).to be_a(GoogleAds::SyncResult)
          expect(result.unchanged?).to be true
          expect(result.synced?).to be true
        end
      end

      context 'when always_on but stale criterion exists' do
        before do
          always_on_schedule.platform_settings["google"] = { "criterion_id" => 999 }
          always_on_schedule.save!
        end

        it 'deletes the stale criterion to achieve always-on state' do
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
