# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Campaign AdSchedule Google Integration' do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account) }

  before do
    mock_google_ads_client

    # Configure campaign with Google IDs - use any_instance to handle association reloads
    allow_any_instance_of(Campaign).to receive(:google_customer_id).and_return('1234567890')
    allow_any_instance_of(Campaign).to receive(:google_campaign_id).and_return(789)

    # Default: allow resource creation mocks
    allow(@mock_resource).to receive(:ad_schedule_info).and_yield(mock_ad_schedule_info_resource)
    allow(@mock_operation).to receive(:create_resource).and_return(@mock_operation)
    allow(@mock_operation).to receive(:campaign_criterion).and_yield(mock_campaign_criterion_with_ad_schedule_resource)
    allow(@mock_remove_resource).to receive(:campaign_criterion).and_return(double("RemoveOp"))

    # Default: allow search queries
    allow(@mock_google_ads_service).to receive(:search).and_return([])
  end

  # ═══════════════════════════════════════════════════════════════
  # SCENARIO 1: always_on → specific schedules
  # ═══════════════════════════════════════════════════════════════

  describe 'switching from always_on to specific schedules' do
    before do
      campaign.ad_schedules.create!(always_on: true)
    end

    context 'when Google has NO schedules (local was never synced)' do
      it 'creates new schedule criteria in Google' do
        # Mock: Google returns empty when checking for existing schedules
        allow(@mock_google_ads_service).to receive(:search)
          .with(hash_including(query: match(/type = 'AD_SCHEDULE'/)))
          .and_return([])

        # Mock: Expect create operations for Mon, Tue
        expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .twice  # One for each day
          .and_return(mock_mutate_campaign_criterion_response(criterion_id: 111))

        # Act: Update schedules locally then sync to Google
        campaign.update_ad_schedules(
          always_on: false,
          day_of_week: %w[Monday Tuesday],
          start_time: '9:00am',
          end_time: '5:00pm'
        )

        result = campaign.sync_ad_schedules

        # Verify local state changed
        expect(campaign.ad_schedules.reload.count).to eq(2)
        expect(campaign.ad_schedules.pluck(:day_of_week)).to match_array(%w[Monday Tuesday])
        expect(campaign.always_on?).to be false
      end
    end

    context 'when Google HAS schedules (previous always_on sync left orphans)' do
      before do
        # Local: always_on=true, criterion_id=888 (from previous partial sync)
        campaign.ad_schedules.first.update_column(
          :platform_settings, { 'google' => { 'criterion_id' => 888 } }
        )
      end

      it 'deletes orphaned schedules before creating new ones' do
        # Mock: Google has criterion 888
        allow(@mock_google_ads_service).to receive(:search)
          .with(hash_including(query: match(/type = 'AD_SCHEDULE'/)))
          .and_return(mock_search_response_with_ad_schedule_criteria([888]))

        # Mock: Expect deletion of 888
        expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .with(hash_including(customer_id: '1234567890'))
          .at_least(:once)
          .and_return(mock_mutate_campaign_criterion_response(criterion_id: 111))

        campaign.update_ad_schedules(
          always_on: false,
          day_of_week: %w[Monday],
          start_time: '9:00am',
          end_time: '5:00pm'
        )

        result = campaign.sync_ad_schedules

        expect(campaign.ad_schedules.reload.count).to eq(1)
        expect(campaign.ad_schedules.first.day_of_week).to eq('Monday')
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # SCENARIO 2: specific schedules → always_on
  # ═══════════════════════════════════════════════════════════════

  describe 'switching from specific schedules to always_on' do
    before do
      # Local: Mon & Tue schedules exist with Google criterion IDs
      campaign.ad_schedules.create!(
        day_of_week: 'Monday',
        start_hour: 9, start_minute: 0,
        end_hour: 17, end_minute: 0,
        always_on: false,
        platform_settings: { 'google' => { 'criterion_id' => 111 } }
      )
      campaign.ad_schedules.create!(
        day_of_week: 'Tuesday',
        start_hour: 9, start_minute: 0,
        end_hour: 17, end_minute: 0,
        always_on: false,
        platform_settings: { 'google' => { 'criterion_id' => 222 } }
      )
    end

    context 'when Google has matching schedules' do
      it 'deletes soft-deleted schedule and cleans up reused schedule criterion' do
        # The flow is:
        # 1. update_ad_schedules REUSES Mon as always_on (keeps criterion_id 111),
        #    soft-deletes Tue (keeps criterion_id 222)
        # 2. sync_ad_schedules calls google_delete on soft-deleted Tue (criterion 222)
        # 3. sync_ad_schedules calls google_sync on always_on which finds 111 still in Google
        #    and deletes it (since always_on means ZERO schedules)

        # Mock: after Tue is deleted, Google still has Mon's criterion (111)
        allow(@mock_google_ads_service).to receive(:search)
          .with(hash_including(query: match(/type = 'AD_SCHEDULE'/)))
          .and_return(mock_search_response_with_ad_schedule_criteria([111]))

        # Expect 2 mutate calls:
        # 1. Delete soft-deleted Tue (criterion 222)
        # 2. always_on sync deletes remaining 111
        expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .twice
          .and_return(mock_mutate_campaign_criterion_response)

        campaign.update_ad_schedules(always_on: true)
        result = campaign.sync_ad_schedules

        # Verify local state is always_on
        expect(campaign.ad_schedules.reload.count).to eq(1)
        expect(campaign.always_on?).to be true
      end
    end

    context 'when Google has schedules we did NOT know about (orphans)' do
      it 'deletes soft-deleted schedule, then always_on sync cleans up remaining schedules including orphans' do
        # Local: has 2 schedules with criterion_ids 111, 222
        # Google: has 3 (111, 222, 999 - orphan!)
        #
        # The flow:
        # 1. update_ad_schedules REUSES Mon as always_on (criterion 111), soft-deletes Tue (222)
        # 2. Tue.google_delete removes 222 from Google → 1 mutate call
        # 3. always_on.google_sync checks if Google has ANY schedules
        # 4. Google still has [111, 999] → delete_all_schedules_in_google → 1 mutate call (batch)

        # Mock: after Tue is deleted, Google still has Mon's criterion (111) plus orphan (999)
        allow(@mock_google_ads_service).to receive(:search)
          .with(hash_including(query: match(/type = 'AD_SCHEDULE'/)))
          .and_return(mock_search_response_with_ad_schedule_criteria([111, 999]))

        # Expect 2 mutate calls:
        # 1. Delete soft-deleted Tue (criterion 222)
        # 2. always_on sync batch-deletes remaining [111, 999]
        expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .twice
          .and_return(mock_mutate_campaign_criterion_response)

        campaign.update_ad_schedules(always_on: true)
        result = campaign.sync_ad_schedules

        expect(campaign.always_on?).to be true
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # SCENARIO 3: Modifying schedule times (recreate)
  # ═══════════════════════════════════════════════════════════════

  describe 'modifying schedule times' do
    before do
      campaign.ad_schedules.create!(
        day_of_week: 'Monday',
        start_hour: 9, start_minute: 0,
        end_hour: 17, end_minute: 0,
        always_on: false,
        platform_settings: { 'google' => { 'criterion_id' => 555 } }
      )
    end

    it 'recreates criterion with new times (delete old, create new)' do
      # Mock: Google has criterion 555 with old times (matching)
      allow(@mock_google_ads_service).to receive(:search)
        .with(hash_including(query: match(/criterion_id = 555/)))
        .and_return(mock_search_response_with_ad_schedule(
          criterion_id: 555,
          day_of_week: :MONDAY,
          start_hour: 9, start_minute: :ZERO,
          end_hour: 17, end_minute: :ZERO
        ))

      # After update, fields won't match anymore and sync will call recreate.
      # recreate() makes 2 separate mutate calls:
      # 1. remove_from_google (delete old criterion 555)
      # 2. mutate([build_create_operation]) (create new criterion)
      expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
        .twice
        .and_return(mock_mutate_campaign_criterion_response(criterion_id: 556))

      campaign.update_ad_schedules(
        always_on: false,
        day_of_week: %w[Monday],
        start_time: '10:00am',  # Changed!
        end_time: '6:00pm'      # Changed!
      )

      result = campaign.sync_ad_schedules

      # Local schedule should have new times
      schedule = campaign.ad_schedules.reload.first
      expect(schedule.start_hour).to eq(10)
      expect(schedule.end_hour).to eq(18)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # SCENARIO 4: Adding days (new creates)
  # ═══════════════════════════════════════════════════════════════

  describe 'adding days to schedule' do
    before do
      campaign.ad_schedules.create!(
        day_of_week: 'Monday',
        start_hour: 9, start_minute: 0,
        end_hour: 17, end_minute: 0,
        always_on: false,
        platform_settings: { 'google' => { 'criterion_id' => 111 } }
      )
    end

    it 'creates new criteria for added days' do
      # Mock: Google has criterion 111 for Monday (synced)
      allow(@mock_google_ads_service).to receive(:search)
        .with(hash_including(query: match(/criterion_id = 111/)))
        .and_return(mock_search_response_with_ad_schedule(
          criterion_id: 111,
          day_of_week: :MONDAY,
          start_hour: 9, start_minute: :ZERO,
          end_hour: 17, end_minute: :ZERO
        ))

      # Mock: For new Tuesday schedule, no criterion_id yet
      allow(@mock_google_ads_service).to receive(:search)
        .with(hash_including(query: match(/type = 'AD_SCHEDULE'/)))
        .and_return(mock_search_response_with_ad_schedule_criteria([111]))

      # Expect create for Tuesday only (Monday unchanged)
      expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
        .and_return(mock_mutate_campaign_criterion_response(criterion_id: 222))

      campaign.update_ad_schedules(
        always_on: false,
        day_of_week: %w[Monday Tuesday],
        start_time: '9:00am',
        end_time: '5:00pm'
      )

      result = campaign.sync_ad_schedules

      expect(campaign.ad_schedules.reload.count).to eq(2)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # SCENARIO 5: Removing days (soft delete + Google delete)
  # ═══════════════════════════════════════════════════════════════

  describe 'removing days from schedule' do
    before do
      campaign.ad_schedules.create!(
        day_of_week: 'Monday',
        start_hour: 9, start_minute: 0,
        end_hour: 17, end_minute: 0,
        always_on: false,
        platform_settings: { 'google' => { 'criterion_id' => 111 } }
      )
      campaign.ad_schedules.create!(
        day_of_week: 'Tuesday',
        start_hour: 9, start_minute: 0,
        end_hour: 17, end_minute: 0,
        always_on: false,
        platform_settings: { 'google' => { 'criterion_id' => 222 } }
      )
    end

    it 'deletes removed day criterion from Google' do
      # Mock: Google has both criteria
      allow(@mock_google_ads_service).to receive(:search)
        .with(hash_including(query: match(/criterion_id = 111/)))
        .and_return(mock_search_response_with_ad_schedule(
          criterion_id: 111, day_of_week: :MONDAY,
          start_hour: 9, start_minute: :ZERO, end_hour: 17, end_minute: :ZERO
        ))

      # Tuesday will be soft-deleted locally, needs Google delete
      expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
        .and_return(mock_mutate_campaign_criterion_response)

      campaign.update_ad_schedules(
        always_on: false,
        day_of_week: %w[Monday],  # Tuesday removed!
        start_time: '9:00am',
        end_time: '5:00pm'
      )

      result = campaign.sync_ad_schedules

      # Local: only Monday remains (Tuesday soft-deleted)
      expect(campaign.ad_schedules.reload.count).to eq(1)
      expect(campaign.ad_schedules.first.day_of_week).to eq('Monday')

      # Soft-deleted Tuesday should still exist in DB
      deleted = AdSchedule.only_deleted.where(campaign_id: campaign.id)
      expect(deleted.count).to eq(1)
      expect(deleted.first.day_of_week).to eq('Tuesday')
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # SCENARIO 6: No changes needed (already synced)
  # ═══════════════════════════════════════════════════════════════

  describe 'when already synced' do
    before do
      campaign.ad_schedules.create!(
        day_of_week: 'Monday',
        start_hour: 9, start_minute: 0,
        end_hour: 17, end_minute: 0,
        always_on: false,
        platform_settings: { 'google' => { 'criterion_id' => 111 } }
      )
    end

    it 'makes no mutations when Google matches local' do
      # Mock: Google has matching criterion
      allow(@mock_google_ads_service).to receive(:search)
        .with(hash_including(query: match(/criterion_id = 111/)))
        .and_return(mock_search_response_with_ad_schedule(
          criterion_id: 111,
          day_of_week: :MONDAY,
          start_hour: 9, start_minute: :ZERO,
          end_hour: 17, end_minute: :ZERO
        ))

      # Expect NO mutations
      expect(@mock_campaign_criterion_service).not_to receive(:mutate_campaign_criteria)

      # No local changes - just sync
      result = campaign.sync_ad_schedules

      expect(result.results.first.unchanged?).to be true
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # SCENARIO 7: always_on when Google has unknown schedules
  # ═══════════════════════════════════════════════════════════════

  describe 'always_on sync when Google has unknown schedules' do
    before do
      # Local: always_on=true, no criterion_id (thinks we're clean)
      campaign.ad_schedules.create!(always_on: true)
    end

    it 'detects and deletes unknown Google schedules' do
      # Mock: Google actually has schedules we don't know about!
      allow(@mock_google_ads_service).to receive(:search)
        .with(hash_including(query: match(/type = 'AD_SCHEDULE'/)))
        .and_return(mock_search_response_with_ad_schedule_criteria([888, 999]))

      # Expect deletion of both unknown criteria
      expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
        .with(hash_including(
          operations: satisfy { |ops| ops.length == 2 }
        ))
        .and_return(mock_mutate_campaign_criterion_response)

      result = campaign.sync_ad_schedules

      expect(result.results.first.deleted?).to be true
    end

    it 'reports unchanged when Google is clean' do
      # Mock: Google has NO schedules (correctly in always_on state)
      allow(@mock_google_ads_service).to receive(:search)
        .with(hash_including(query: match(/type = 'AD_SCHEDULE'/)))
        .and_return([])

      # Expect NO mutations
      expect(@mock_campaign_criterion_service).not_to receive(:mutate_campaign_criteria)

      result = campaign.sync_ad_schedules

      expect(result.results.first.unchanged?).to be true
    end
  end
end
