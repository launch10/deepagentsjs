require 'rails_helper'

RSpec.describe Schedule do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, account: account) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }
  let(:schedule) { Schedule.new(campaign) }

  describe '#empty?' do
    it 'returns true when no schedules exist' do
      expect(schedule.empty?).to be true
    end

    it 'returns false when schedules exist' do
      campaign.ad_schedules.create!(always_on: true)
      expect(schedule.empty?).to be false
    end
  end

  describe '#blank?' do
    it 'returns true when no schedules exist' do
      expect(schedule.blank?).to be true
    end

    it 'returns false when schedules exist' do
      campaign.ad_schedules.create!(always_on: true)
      expect(schedule.blank?).to be false
    end
  end

  describe '#present?' do
    it 'returns false when no schedules exist' do
      expect(schedule.present?).to be false
    end

    it 'returns true when schedules exist' do
      campaign.ad_schedules.create!(always_on: true)
      expect(schedule.present?).to be true
    end
  end

  describe '#always_on?' do
    it 'returns true when always_on schedule exists' do
      campaign.ad_schedules.create!(always_on: true)
      expect(schedule.always_on?).to be true
    end

    it 'returns false when only scheduled times exist' do
      campaign.ad_schedules.create!(
        day_of_week: 'Monday',
        start_hour: 9,
        start_minute: 0,
        end_hour: 17,
        end_minute: 0,
        always_on: false
      )
      expect(schedule.always_on?).to be false
    end
  end

  describe '#scheduled?' do
    it 'returns true when scheduled times exist' do
      campaign.ad_schedules.create!(
        day_of_week: 'Monday',
        start_hour: 9,
        start_minute: 0,
        end_hour: 17,
        end_minute: 0,
        always_on: false
      )
      expect(schedule.scheduled?).to be true
    end

    it 'returns false when only always_on exists' do
      campaign.ad_schedules.create!(always_on: true)
      expect(schedule.scheduled?).to be false
    end
  end

  describe '#on_now?' do
    context 'when empty' do
      it 'returns false' do
        expect(schedule.on_now?).to be false
      end
    end

    context 'with always_on schedule' do
      before do
        campaign.ad_schedules.create!(always_on: true)
      end

      it 'returns true at any time' do
        expect(schedule.on_now?(Time.parse('2025-01-06 14:30'))).to be true
        expect(schedule.on_now?(Time.parse('2025-01-07 02:00'))).to be true
      end
    end

    context 'with scheduled times' do
      before do
        campaign.ad_schedules.create!(
          day_of_week: 'Monday',
          start_hour: 9,
          start_minute: 0,
          end_hour: 17,
          end_minute: 0,
          always_on: false
        )
      end

      it 'returns true during scheduled hours' do
        monday_at_noon = Time.parse('2025-01-06 12:00')
        expect(schedule.on_now?(monday_at_noon)).to be true
      end

      it 'returns false outside scheduled hours' do
        monday_at_8am = Time.parse('2025-01-06 08:00')
        expect(schedule.on_now?(monday_at_8am)).to be false
      end
    end
  end

  describe '#time_zone' do
    it 'returns campaign time zone' do
      expect(schedule.time_zone).to eq('America/New_York')
    end

    it 'can be updated' do
      schedule.time_zone = 'America/Los_Angeles'
      campaign.reload
      expect(campaign.time_zone).to eq('America/Los_Angeles')
    end
  end

  describe '#for' do
    before do
      campaign.ad_schedules.create!(
        day_of_week: 'Monday',
        start_hour: 9,
        start_minute: 0,
        end_hour: 17,
        end_minute: 0,
        always_on: false
      )
      campaign.ad_schedules.create!(
        day_of_week: 'Tuesday',
        start_hour: 10,
        start_minute: 0,
        end_hour: 18,
        end_minute: 0,
        always_on: false
      )
    end

    it 'returns schedules for a specific day' do
      monday_schedules = schedule.for('Monday')
      expect(monday_schedules.count).to eq(1)
      expect(monday_schedules.first.day_of_week).to eq('Monday')
    end
  end

  describe '#hours_per_week' do
    context 'with always_on schedule' do
      before do
        campaign.ad_schedules.create!(always_on: true)
      end

      it 'returns 168 hours (24*7)' do
        expect(schedule.hours_per_week).to eq(168)
      end
    end

    context 'with scheduled times' do
      before do
        campaign.ad_schedules.create!(
          day_of_week: 'Monday',
          start_hour: 9,
          start_minute: 0,
          end_hour: 17,
          end_minute: 0,
          always_on: false
        )
        campaign.ad_schedules.create!(
          day_of_week: 'Tuesday',
          start_hour: 9,
          start_minute: 0,
          end_hour: 17,
          end_minute: 0,
          always_on: false
        )
      end

      it 'calculates total hours' do
        expect(schedule.hours_per_week).to eq(16)
      end
    end
  end

  describe '#as_json' do
    context 'with always_on schedule' do
      before do
        campaign.ad_schedules.create!(always_on: true)
      end

      it 'returns always_on format' do
        expect(schedule.as_json).to eq(
          always_on: true,
          day_of_week: [],
          start_time: nil,
          end_time: nil,
          time_zone: 'America/New_York'
        )
      end
    end

    context 'with scheduled times' do
      before do
        campaign.ad_schedules.create!(
          day_of_week: 'Monday',
          start_hour: 9,
          start_minute: 0,
          end_hour: 22,
          end_minute: 0,
          always_on: false
        )
        campaign.ad_schedules.create!(
          day_of_week: 'Tuesday',
          start_hour: 9,
          start_minute: 0,
          end_hour: 22,
          end_minute: 0,
          always_on: false
        )
      end

      it 'returns grouped schedule format' do
        result = schedule.as_json
        expect(result[:always_on]).to be false
        expect(result[:day_of_week]).to match_array(['Monday', 'Tuesday'])
        expect(result[:start_time]).to eq('9:00am')
        expect(result[:end_time]).to eq('10:00pm')
        expect(result[:time_zone]).to eq('America/New_York')
      end
    end

    context 'with no schedules' do
      it 'returns empty format' do
        expect(schedule.as_json).to eq(
          always_on: false,
          day_of_week: [],
          start_time: nil,
          end_time: nil,
          time_zone: 'America/New_York'
        )
      end
    end
  end

  describe '#update' do
    context 'with always_on data' do
      it 'creates always_on schedule' do
        schedule.update(always_on: true)
        expect(campaign.ad_schedules.count).to eq(1)
        expect(campaign.ad_schedules.first.always_on).to be true
      end
    end

    context 'with scheduled data' do
      it 'creates schedules for each day' do
        schedule.update(
          always_on: false,
          day_of_week: ['Monday', 'Tuesday'],
          start_time: '9:00am',
          end_time: '10:00pm',
          time_zone: 'America/Chicago'
        )

        expect(campaign.ad_schedules.count).to eq(2)

        monday_schedule = campaign.ad_schedules.find_by(day_of_week: 'Monday')
        expect(monday_schedule.start_hour).to eq(9)
        expect(monday_schedule.start_minute).to eq(0)
        expect(monday_schedule.end_hour).to eq(22)
        expect(monday_schedule.end_minute).to eq(0)
        expect(monday_schedule.always_on).to be false
      end

      it 'updates campaign time zone' do
        schedule.update(
          always_on: false,
          day_of_week: ['Monday'],
          start_time: '9:00am',
          end_time: '5:00pm',
          time_zone: 'America/Los_Angeles'
        )

        campaign.reload
        expect(campaign.time_zone).to eq('America/Los_Angeles')
      end
    end
  end
end
