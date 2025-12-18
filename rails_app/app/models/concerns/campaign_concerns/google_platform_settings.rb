module CampaignConcerns
  module GooglePlatformSettings
    extend ActiveSupport::Concern
    include PlatformSettings

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
      SEARCH_MOBILE_APP
      DISPLAY_MOBILE_APP
      SEARCH_EXPRESS
      DISPLAY_EXPRESS
      SHOPPING_SMART_ADS
      DISPLAY_GMAIL_AD
      DISPLAY_SMART_CAMPAIGN
      VIDEO_ACTION
      VIDEO_NON_SKIPPABLE
      APP_CAMPAIGN
      APP_CAMPAIGN_FOR_ENGAGEMENT
      LOCAL_CAMPAIGN
      SHOPPING_COMPARISON_LISTING_ADS
      SMART_CAMPAIGN
      VIDEO_SEQUENCE
      APP_CAMPAIGN_FOR_PRE_REGISTRATION
      VIDEO_REACH_TARGET_FREQUENCY
      TRAVEL_ACTIVITIES
      YOUTUBE_AUDIO
    ].freeze

    CHANNEL_TYPE_SUB_TYPE_MAP = {
      "SEARCH" => [],
      "DISPLAY" => ["DISPLAY_MOBILE_APP", "DISPLAY_GMAIL_AD", "DISPLAY_SMART_CAMPAIGN"],
      "PERFORMANCE_MAX" => [],  # No sub-types for Performance Max
      "DEMAND_GEN" => [],
      "SHOPPING" => ["SHOPPING_SMART_ADS", "SHOPPING_COMPARISON_LISTING_ADS"],
      "MULTI_CHANNEL" => ["APP_CAMPAIGN", "APP_CAMPAIGN_FOR_ENGAGEMENT", "APP_CAMPAIGN_FOR_PRE_REGISTRATION"],
      "LOCAL" => ["LOCAL_CAMPAIGN"],
      "HOTEL" => [],
      "TRAVEL" => ["TRAVEL_ACTIVITIES"],
      "SMART" => ["SMART_CAMPAIGN"],
      "VIDEO" => ["VIDEO_ACTION", "VIDEO_NON_SKIPPABLE", "VIDEO_SEQUENCE", "VIDEO_REACH_TARGET_FREQUENCY", "YOUTUBE_AUDIO"]
    }.freeze

    NETWORK_SETTINGS_FIELDS = %w[
      target_google_search
      target_search_network
      target_content_network
      target_partner_search_network
      target_youtube
      target_google_tv_network
    ].freeze

    # Default network settings by campaign type
    DEFAULT_NETWORK_SETTINGS = {
      "SEARCH" => {
        target_google_search: true,
        target_search_network: true,
        target_content_network: true,  # Display Expansion
        target_partner_search_network: false,
        target_youtube: false,
        target_google_tv_network: false
      },
      "DISPLAY" => {
        target_google_search: false,
        target_search_network: false,
        target_content_network: true,
        target_partner_search_network: false,
        target_youtube: false,
        target_google_tv_network: false
      },
      "VIDEO" => {
        target_google_search: false,
        target_search_network: false,
        target_content_network: false,
        target_partner_search_network: false,
        target_youtube: true,
        target_google_tv_network: true
      },
      "PERFORMANCE_MAX" => {
        # Performance Max automatically targets all networks
        # Network settings are typically not used/ignored
      }
    }.freeze

    # We're just setting defaults today (Maximize clicks), but for future versions, I wanted to capture some of the logic here
    Field = Struct.new(:name, :is_required, :type, keyword_init: true)
    BIDDING_STRATEGIES = {
      # Set an average daily budget and the Google Ads system sets your maximum cost per click (CPC) bids on your behalf, with the goal of getting you the most clicks possible within that budget.
      # I.e. maximize traffic
      MAXIMIZE_CLICKS: {
        api_field: "target_spend",
        fields: [
          Field.new(name: "cpc_bid_ceiling_micros", is_required: false, type: "int64")
        ]
      },

      # To use Target ROAS bidding, most campaign types need at least 15 conversions in the past 30 days.
      # https://support.google.com/google-ads/answer/6268637
      MAXIMIZE_ROAS: {
        api_field: "target_roas",
        fields: [
          Field.new(name: "target_roas", is_required: false, type: "double"),
          Field.new(name: "cpc_bid_ceiling_micros", is_required: false, type: "int64"),
          Field.new(name: "cpc_bid_floor_micros", is_required: false, type: "int64"),
          Field.new(name: "target_roas_tolerance_percent_millis", is_required: false, type: "int64")
        ]
      },

      # I.e. maximize leads / signups
      # set with target_cpa field
      MAXIMIZE_CONVERSIONS: {
        api_field: "maximize_conversions",
        fields: [
          Field.new(name: "target_cpa_micros", is_required: false, type: "int64"),
          Field.new(name: "cpc_bid_ceiling_micros", is_required: false, type: "int64"),
          Field.new(name: "cpc_bid_floor_micros", is_required: false, type: "int64")
        ]
      },

      # For ecommerce sales
      # with target_roas set
      MAXIMIZE_CONVERSION_VALUE: {
        api_field: "maximize_conversion_value",
        fields: [
          Field.new(name: "target_roas", is_required: false, type: "double"),
          Field.new(name: "cpc_bid_ceiling_micros", is_required: false, type: "int64"),
          Field.new(name: "cpc_bid_floor_micros", is_required: false, type: "int64"),
          Field.new(name: "target_roas_tolerance_percent_millis", is_required: false, type: "int64")
        ]
      }
    }

    CAMPAIGN_STATUSES = %w[
      ENABLED
      PAUSED
      REMOVED
    ].freeze

    included do
      platform_setting :google, :campaign_id # foreign key
      platform_setting :google, :advertising_channel_type, in: ADVERTISING_CHANNEL_TYPES, default: "SEARCH"
      platform_setting :google, :advertising_channel_sub_type, in: ADVERTISING_CHANNEL_SUB_TYPES
      platform_setting :google, :bidding_strategy, in: BIDDING_STRATEGIES.keys
      platform_setting :google, :status, in: CAMPAIGN_STATUSES, default: "PAUSED"

      NETWORK_SETTINGS_FIELDS.each do |field|
        # e.g. google_target_google_search, google_target_search_network, etc.
        platform_setting :google, field.to_sym
      end
    end

    def google_valid_sub_type_for_channel_type?
      sub_type = google_advertising_channel_sub_type
      return true if sub_type.nil?

      channel_type = google_advertising_channel_type
      valid_sub_types = CHANNEL_TYPE_SUB_TYPE_MAP[channel_type] || []
      valid_sub_types.include?(sub_type)
    end

    # TODO: Move to an API module...
    def google_network_settings_for_api(client)
      client.resource.network_settings do |ns|
        ns.target_google_search = google_target_google_search if google_target_google_search.present?
        ns.target_search_network = google_target_search_network if google_target_search_network.present?
        ns.target_content_network = google_target_content_network if google_target_content_network.present?
        ns.target_partner_search_network = google_target_partner_search_network if google_target_partner_search_network.present?
        ns.target_youtube = google_target_youtube if google_target_youtube.present?
        ns.target_google_tv_network = google_target_google_tv_network if google_target_google_tv_network.present?
      end
    end

    # TODO: Move to an API module...
    def google_ready_to_enable?
      google_advertising_channel_type.present? &&
        google_bidding_strategy.present? &&
        google_language_codes.present? &&
        google_customer_id.present? &&
        billing_enabled?
    end

    # TODO: Move to an API module...
    # Enable campaign (change status from PAUSED to ENABLED)
    def enable_google_campaign!(client)
      return false unless google_ready_to_enable?
      return false if google_status == "ENABLED"

      update_google_campaign_status!(client, :ENABLED)
    end

    # TODO: Move to an API module...
    # Pause campaign
    def pause_google_campaign!(client)
      return false if google_status == "PAUSED"

      update_google_campaign_status!(client, :PAUSED)
    end

    # TODO: Move to an API module...
    def update_google_campaign_status!(client, new_status)
      operation = client.operation.update_resource.campaign(google_campaign_resource_name) do |c|
        c.status = new_status
      end

      client.service.campaign.mutate_campaigns(
        customer_id: google_customer_id,
        operations: [operation]
      )

      self.google_status = new_status.to_s
      save!

      true
    rescue => e
      Rails.logger.error("Failed to update campaign status: #{e.message}")
      false
    end

    def apply_default_network_settings_for_channel_type
      channel_type = google_advertising_channel_type
      defaults = DEFAULT_NETWORK_SETTINGS[channel_type] || {}

      defaults.each do |field, value|
        setter = "google_#{field}="
        send(setter, value) if respond_to?(setter) && send("google_#{field}").nil?
      end
    end
  end
end
