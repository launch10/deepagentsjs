# == Schema Information
#
# Table name: ad_schedules
#
#  id                :bigint           not null, primary key
#  always_on         :boolean          default(FALSE)
#  bid_modifier      :decimal(10, 2)
#  day_of_week       :string
#  end_hour          :integer
#  end_minute        :integer
#  platform_settings :jsonb
#  start_hour        :integer
#  start_minute      :integer
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  campaign_id       :bigint           not null
#
# Indexes
#
#  index_ad_schedules_on_always_on                    (always_on)
#  index_ad_schedules_on_campaign_id                  (campaign_id)
#  index_ad_schedules_on_campaign_id_and_day_of_week  (campaign_id,day_of_week)
#  index_ad_schedules_on_created_at                   (created_at)
#  index_ad_schedules_on_criterion_id                 ((((platform_settings -> 'google'::text) ->> 'criterion_id'::text)))
#  index_ad_schedules_on_day_of_week                  (day_of_week)
#  index_ad_schedules_on_platform_settings            (platform_settings) USING gin
#
require 'rails_helper'

RSpec.describe AdSchedule, type: :model do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, account: account) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }

  describe 'validations' do
    describe 'always_on schedules' do
      it 'allows a single always_on schedule' do
        schedule = campaign.ad_schedules.build(always_on: true)
        expect(schedule).to be_valid
      end

      it 'prevents multiple schedules when always_on is true' do
        campaign.ad_schedules.create!(always_on: true)
        schedule = campaign.ad_schedules.build(always_on: true)
        expect(schedule).not_to be_valid
        expect(schedule.errors[:always_on]).to include("cannot be true when other schedules exist")
      end

      it 'prevents time fields when always_on is true' do
        schedule = campaign.ad_schedules.build(
          always_on: true,
          day_of_week: 'Monday',
          start_hour: 9,
          start_minute: 0,
          end_hour: 17,
          end_minute: 0
        )
        expect(schedule).not_to be_valid
        expect(schedule.errors[:always_on]).to include("schedule should not have time fields when always_on is true")
      end
    end

    describe 'scheduled times' do
      it 'allows multiple scheduled time slots' do
        campaign.ad_schedules.create!(
          day_of_week: 'Monday',
          start_hour: 9,
          start_minute: 0,
          end_hour: 17,
          end_minute: 0,
          always_on: false
        )
        schedule = campaign.ad_schedules.build(
          day_of_week: 'Tuesday',
          start_hour: 9,
          start_minute: 0,
          end_hour: 17,
          end_minute: 0,
          always_on: false
        )
        expect(schedule).to be_valid
      end
    end
  end

  describe '#on_now?' do
    context 'with always_on schedule' do
      let!(:schedule) { campaign.ad_schedules.create!(always_on: true) }

      it 'returns true at any time' do
        expect(schedule.on_now?(Time.parse('2025-01-06 14:30'))).to be true
        expect(schedule.on_now?(Time.parse('2025-01-07 02:00'))).to be true
      end
    end

    context 'with scheduled times' do
      let!(:schedule) do
        campaign.ad_schedules.create!(
          day_of_week: 'Monday',
          start_hour: 9,
          start_minute: 0,
          end_hour: 17,
          end_minute: 0,
          always_on: false
        )
      end

      it 'returns true during scheduled hours on correct day' do
        monday_at_noon = Time.parse('2025-01-06 12:00')
        expect(schedule.on_now?(monday_at_noon)).to be true
      end

      it 'returns false before scheduled hours' do
        monday_at_8am = Time.parse('2025-01-06 08:00')
        expect(schedule.on_now?(monday_at_8am)).to be false
      end

      it 'returns false after scheduled hours' do
        monday_at_6pm = Time.parse('2025-01-06 18:00')
        expect(schedule.on_now?(monday_at_6pm)).to be false
      end

      it 'returns false on different day' do
        tuesday_at_noon = Time.parse('2025-01-07 12:00')
        expect(schedule.on_now?(tuesday_at_noon)).to be false
      end
    end
  end

  describe 'scopes' do
    let!(:always_on_schedule) { campaign.ad_schedules.create!(always_on: true) }
    let!(:other_campaign) { create(:campaign, account: account, project: project, website: website) }
    let!(:scheduled_schedule) do
      other_campaign.ad_schedules.create!(
        day_of_week: 'Monday',
        start_hour: 9,
        start_minute: 0,
        end_hour: 17,
        end_minute: 0,
        always_on: false
      )
    end

    it 'filters always_on schedules' do
      expect(AdSchedule.always_on).to include(always_on_schedule)
      expect(AdSchedule.always_on).not_to include(scheduled_schedule)
    end

    it 'filters scheduled schedules' do
      expect(AdSchedule.scheduled).to include(scheduled_schedule)
      expect(AdSchedule.scheduled).not_to include(always_on_schedule)
    end
  end
end
