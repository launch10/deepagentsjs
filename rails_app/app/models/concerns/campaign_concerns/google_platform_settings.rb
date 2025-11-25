module CampaignConcerns
  module GooglePlatformSettings
    extend ActiveSupport::Concern

    ADVERTISING_CHANNEL_TYPES = %w[
      SEARCH
      DISPLAY
      PERFORMANCE_MAX
      DEMAND_GEN
      SHOPPING
      MULTI_CHANNEL
      LOCAL
      HOTEL
      TRAVEL
      SMART
      VIDEO
    ].freeze

    ADVERTISING_CHANNEL_SUB_TYPES = %w[
      TRAVEL_GOALS
    ].freeze

    CHANNEL_TYPE_SUB_TYPE_MAP = {
      "SEARCH" => [],
      "DISPLAY" => [],
      "PERFORMANCE_MAX" => ["TRAVEL_GOALS"],
      "DEMAND_GEN" => [],
      "SHOPPING" => [],
      "MULTI_CHANNEL" => [],
      "LOCAL" => [],
      "HOTEL" => [],
      "TRAVEL" => [],
      "SMART" => [],
      "VIDEO" => []
    }.freeze

    included do
      platform_setting :google, :advertising_channel_type, in: ADVERTISING_CHANNEL_TYPES
      platform_setting :google, :advertising_channel_sub_type, in: ADVERTISING_CHANNEL_SUB_TYPES
      platform_setting :google, :bidding_strategy
      platform_setting :google, :campaign_type
    end

    def google_valid_sub_type_for_channel_type?
      sub_type = google_advertising_channel_sub_type
      return true if sub_type.nil?

      channel_type = google_advertising_channel_type
      valid_sub_types = CHANNEL_TYPE_SUB_TYPE_MAP[channel_type] || []
      valid_sub_types.include?(sub_type)
    end
  end
end
