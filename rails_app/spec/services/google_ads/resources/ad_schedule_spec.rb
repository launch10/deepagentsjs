require 'rails_helper'

RSpec.describe GoogleAds::Resources::AdSchedule do
  include GoogleAdsMocks

  let(:campaign) { create(:campaign) }
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
    allow(campaign).to receive(:google_customer_id).and_return("123")
    allow(campaign).to receive(:google_campaign_id).and_return(456)
  end

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
        start_hour: 8,  # different
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
        day_of_week: :TUESDAY,  # different
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
        start_hour: 8,  # different
        start_minute: :ZERO,
        end_hour: 17,
        end_minute: :ZERO,
        bid_modifier: 1.5
      )

      result = resource.compare_fields(remote)
      hash = result.to_h

      puts hash
      expect(hash[:start_hour][:local]).to eq(9)
      expect(hash[:start_hour][:remote]).to eq(8)
      expect(hash[:start_hour][:match]).to be false
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
