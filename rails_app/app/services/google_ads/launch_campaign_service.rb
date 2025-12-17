# app/services/google_ads/launch_campaign_service.rb

# Create a Google Ads client:
# ONLY DO THIS ONCE - YOU CAN REUSE THE SAME CLIENT FOR ALL ENVIRONMENTS
# # # # # # # # # # # # # # # #
# # # # # # # # # # # # # # # #
# # # # # # # # # # # # # # # #
# # # # # # # # # # # # # # # #
# The ONLY thing that routes us to the test account is the customer_id!
# # # # # # # # # # # # # # # #
# # # # # # # # # # # # # # # #
# # # # # # # # # # # # # # # #
# # # # # # # # # # # # # # # #
#
# IMPORTANT: Make sure to use the correct customer ID for your environment.
# https://console.cloud.google.com/auth/clients?project=launch10-479317
# 1) Set web app
# 2) Add authorized redirect URI: http://localhost:3000
# 3) Add authorized redirect URI: https://launch10.ai
# 4) Add authorized redirect URI: https://developers.google.com/oauthplayground/
# 5) Copy Client ID and Client Secret to Rails credentials

# Generate access tokens:
# https://developers.google.com/oauthplayground
# 1) Click gear icon -> Check 'Use your own OAuth credentials'
# 2) Enter your client_id and client_secret
# 3) In left panel, find 'Google Ads API' and select scope:
#    https://www.googleapis.com/auth/adwords
# 4) Click 'Authorize APIs' and grant access
# 5) Click 'Exchange authorization code for tokens'
# 6) Copy the refresh_token to your Rails credentials

# Setup Test accounts:
# https://developers.google.com/google-ads/api/docs/first-call/test-accounts

# So I think i have to set this up separately from the main accoutn (setup using personal Gmail)
module GoogleAds
  class LaunchCampaignService
    attr_reader :campaign, :client, :errors

    def initialize(campaign)
      @campaign = campaign
      @client = GoogleAds.client
      @errors = []
    end

    def call
      return error_result("Campaign is not ready to launch") unless campaign.deployable?

      ActiveRecord::Base.transaction do
        # Set customer ID
        set_customer_id!

        # Create all entities in order
        create_budget!
        create_campaign!
        create_campaign_criteria!
        create_ad_group!
        create_keywords!
        create_assets!
        create_ad!

        # Set campaign to enabled if requested
        enable_campaign! if campaign.google_status == "ENABLED"

        campaign.save!
      end

      success_result
    rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
      handle_google_ads_error(e)
      error_result(errors.join(", "))
    rescue => e
      error_result(e.message)
    end

    private

    def set_customer_id!
      # Get customer ID from environment or configuration
      customer_id = ENV["GOOGLE_ADS_CUSTOMER_ID"] || campaign.account&.google_customer_id
      raise "No Google Ads customer ID configured" unless customer_id

      campaign.google_customer_id = customer_id.tr("-", "")
    end

    def create_budget!
      budget = client.resource.campaign_budget do |b|
        b.name = "Budget for #{campaign.name} - #{Time.current.to_i}"
        b.amount_micros = campaign.daily_budget_cents * 10 # cents to micros
        b.delivery_method = :STANDARD
        b.explicitly_shared = false
      end

      operation = client.operation.create_resource.campaign_budget(budget)

      response = client.service.campaign_budget.mutate_campaign_budgets(
        customer_id: campaign.google_customer_id,
        operations: [operation]
      )

      budget_resource_name = response.results.first.resource_name
      campaign.google_budget_id = budget_resource_name.split("/").last

      Rails.logger.info("Created budget: #{budget_resource_name}")
    end

    def create_campaign!
      google_campaign = client.resource.campaign do |c|
        c.name = campaign.name
        c.status = :PAUSED # Start paused, enable later if requested

        # Channel type
        c.advertising_channel_type = campaign.google_advertising_channel_type.to_sym
        c.advertising_channel_sub_type = campaign.google_advertising_channel_sub_type.to_sym if
campaign.google_advertising_channel_sub_type.present?

        # Bidding strategy
        set_bidding_strategy!(c)

        # Budget
        c.campaign_budget = client.path.campaign_budget(
          campaign.google_customer_id,
          campaign.google_budget_id
        )

        # Network settings
        c.network_settings = client.resource.network_settings do |ns|
          ns.target_google_search = campaign.google_target_google_search
          ns.target_search_network = campaign.google_target_search_network
          ns.target_content_network = campaign.google_target_content_network
          ns.target_partner_search_network = campaign.google_target_partner_search_network
        end

        # Dates
        c.start_date = campaign.start_date.strftime("%Y%m%d") if campaign.start_date
        c.end_date = campaign.end_date.strftime("%Y%m%d") if campaign.end_date

        # EU political advertising
        c.contains_eu_political_advertising = :DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
      end

      operation = client.operation.create_resource.campaign(google_campaign)

      response = client.service.campaign.mutate_campaigns(
        customer_id: campaign.google_customer_id,
        operations: [operation]
      )

      campaign_resource_name = response.results.first.resource_name
      campaign.google_campaign_id = campaign_resource_name.split("/").last

      Rails.logger.info("Created campaign: #{campaign_resource_name}")
    end

    def set_bidding_strategy!(google_campaign)
      strategy_type = campaign.google_bidding_strategy.upcase
      settings = campaign.google_bidding_strategy_settings || {}

      case strategy_type
      when "TARGET_SPEND", "MAXIMIZE_CLICKS"
        google_campaign.target_spend = client.resource.target_spend do |ts|
          ts.cpc_bid_ceiling_micros = settings["cpc_bid_ceiling_micros"] if settings["cpc_bid_ceiling_micros"]
        end
      when "MAXIMIZE_CONVERSIONS"
        google_campaign.maximize_conversions = client.resource.maximize_conversions do |mc|
          mc.target_cpa_micros = settings["target_cpa_micros"] if settings["target_cpa_micros"]
          mc.cpc_bid_ceiling_micros = settings["cpc_bid_ceiling_micros"] if settings["cpc_bid_ceiling_micros"]
          mc.cpc_bid_floor_micros = settings["cpc_bid_floor_micros"] if settings["cpc_bid_floor_micros"]
        end
      when "MAXIMIZE_CONVERSION_VALUE"
        google_campaign.maximize_conversion_value = client.resource.maximize_conversion_value do |mcv|
          mcv.target_roas = settings["target_roas"] if settings["target_roas"]
          mcv.cpc_bid_ceiling_micros = settings["cpc_bid_ceiling_micros"] if settings["cpc_bid_ceiling_micros"]
          mcv.cpc_bid_floor_micros = settings["cpc_bid_floor_micros"] if settings["cpc_bid_floor_micros"]
        end
      when "TARGET_CPA"
        google_campaign.target_cpa = client.resource.target_cpa do |tc|
          tc.target_cpa_micros = settings["target_cpa_micros"]
          tc.cpc_bid_ceiling_micros = settings["cpc_bid_ceiling_micros"] if settings["cpc_bid_ceiling_micros"]
          tc.cpc_bid_floor_micros = settings["cpc_bid_floor_micros"] if settings["cpc_bid_floor_micros"]
        end
      when "TARGET_ROAS"
        google_campaign.target_roas = client.resource.target_roas do |tr|
          tr.target_roas = settings["target_roas"]
          tr.cpc_bid_ceiling_micros = settings["cpc_bid_ceiling_micros"] if settings["cpc_bid_ceiling_micros"]
          tr.cpc_bid_floor_micros = settings["cpc_bid_floor_micros"] if settings["cpc_bid_floor_micros"]
        end
      when "MANUAL_CPC"
        google_campaign.manual_cpc = client.resource.manual_cpc do |mc|
          mc.enhanced_cpc_enabled = settings["enhanced_cpc_enabled"] || false
        end
      else
        raise "Unsupported bidding strategy: #{strategy_type}"
      end
    end

    def create_campaign_criteria!
      operations = []

      # Location targeting
      campaign.location_targets.each do |location|
        operations << client.operation.mutate do |m|
          m.campaign_criterion_operation = client.operation.create_resource.campaign_criterion do |cc|
            cc.campaign = campaign_resource_name
            cc.location = client.resource.location_info do |li|
              li.geo_target_constant = location.geo_target_constant
            end
            cc.negative = !location.targeted
          end
        end
      end

      # Language targeting
      campaign.language_targets.each do |language|
        operations << client.operation.mutate do |m|
          m.campaign_criterion_operation = client.operation.create_resource.campaign_criterion do |cc|
            cc.campaign = campaign_resource_name
            cc.language = client.resource.language_info do |li|
              li.language_constant = client.path.language_constant(language.language_code)
            end
          end
        end
      end

      # Ad schedule targeting
      campaign.ad_schedules.scheduled.each do |schedule|
        operations << client.operation.mutate do |m|
          m.campaign_criterion_operation = client.operation.create_resource.campaign_criterion do |cc|
            cc.campaign = campaign_resource_name
            cc.ad_schedule = client.resource.ad_schedule_info do |as|
              as.day_of_week = schedule.day_of_week.upcase.to_sym
              as.start_hour = schedule.start_hour
              as.start_minute = minute_to_enum(schedule.start_minute)
              as.end_hour = schedule.end_hour
              as.end_minute = minute_to_enum(schedule.end_minute)
            end
            cc.bid_modifier = schedule.bid_modifier if schedule.bid_modifier
          end
        end
      end

      return if operations.empty?

      response = client.service.google_ads.mutate(
        customer_id: campaign.google_customer_id,
        mutate_operations: operations
      )

      # Store criterion IDs
      idx = 0
      campaign.location_targets.each do |location|
        criterion_id = response.mutate_operation_responses[idx].campaign_criterion_result.resource_name.split("~").last
        location.update_column(:google_criterion_id, criterion_id)
        idx += 1
      end

      campaign.language_targets.each do |language|
        criterion_id = response.mutate_operation_responses[idx].campaign_criterion_result.resource_name.split("~").last
        language.update_column(:google_criterion_id, criterion_id)
        idx += 1
      end

      campaign.ad_schedules.scheduled.each do |schedule|
        criterion_id = response.mutate_operation_responses[idx].campaign_criterion_result.resource_name.split("~").last
        schedule.update_column(:google_criterion_id, criterion_id)
        idx += 1
      end

      Rails.logger.info("Created #{operations.size} campaign criteria")
    end

    def create_ad_group!
      ad_group = campaign.ad_groups.first

      google_ad_group = client.resource.ad_group do |ag|
        ag.name = ad_group.name || "Ad Group 1"
        ag.campaign = campaign_resource_name
        ag.status = :ENABLED
        ag.type = :SEARCH_STANDARD

        # Default CPC bid (required for manual CPC)
        ag.cpc_bid_micros = 1_000_000 # $1.00
      end

      operation = client.operation.create_resource.ad_group(google_ad_group)

      response = client.service.ad_group.mutate_ad_groups(
        customer_id: campaign.google_customer_id,
        operations: [operation]
      )

      ad_group_resource_name = response.results.first.resource_name
      ad_group.google_customer_id = campaign.google_customer_id
      ad_group.google_ad_group_id = ad_group_resource_name.split("/").last
      ad_group.save!

      Rails.logger.info("Created ad group: #{ad_group_resource_name}")
    end

    def create_keywords!
      ad_group = campaign.ad_groups.first
      operations = []

      ad_group.keywords.each do |keyword|
        operations << client.operation.create_resource.ad_group_criterion do |agc|
          agc.ad_group = ad_group_resource_name
          agc.keyword = client.resource.keyword_info do |k|
            k.text = keyword.text
            k.match_type = keyword.match_type.upcase.to_sym
          end
          agc.cpc_bid_micros = keyword.max_cpc_bid_cents * 10 if keyword.max_cpc_bid_cents
          agc.status = :ENABLED
        end
      end

      return if operations.empty?

      response = client.service.ad_group_criterion.mutate_ad_group_criteria(
        customer_id: campaign.google_customer_id,
        operations: operations
      )

      # Store criterion IDs
      ad_group.keywords.each_with_index do |keyword, idx|
        criterion_id = response.results[idx].resource_name.split("~").last
        keyword.google_customer_id = campaign.google_customer_id
        keyword.google_ad_group_id = ad_group.google_ad_group_id
        keyword.google_criterion_id = criterion_id
        keyword.save!
      end

      Rails.logger.info("Created #{operations.size} keywords")
    end

    def create_assets!
      ad_group = campaign.ad_groups.first
      operations = []

      # Create callout assets
      ad_group.callouts.each do |callout|
        operations << client.operation.mutate do |m|
          m.asset_operation = client.operation.create_resource.asset do |asset|
            asset.callout_asset = client.resource.callout_asset do |ca|
              ca.text = callout.text
            end
          end
        end
      end

      # Create structured snippet assets
      if campaign.structured_snippet.present?
        snippet = campaign.structured_snippet
        operations << client.operation.mutate do |m|
          m.asset_operation = client.operation.create_resource.asset do |asset|
            asset.structured_snippet_asset = client.resource.structured_snippet_asset do |ssa|
              ssa.header = snippet.header
              ssa.values += snippet.values
            end
          end
        end
      end

      return if operations.empty?

      response = client.service.google_ads.mutate(
        customer_id: campaign.google_customer_id,
        mutate_operations: operations
      )

      # Store asset IDs and link to campaign
      link_operations = []
      asset_idx = 0

      ad_group.callouts.each do |callout|
        asset_resource_name = response.mutate_operation_responses[asset_idx].asset_result.resource_name
        asset_id = asset_resource_name.split("/").last

        callout.google_customer_id = campaign.google_customer_id
        callout.google_asset_id = asset_id
        callout.save!

        # Link to campaign
        link_operations << client.operation.mutate do |m|
          m.campaign_asset_operation = client.operation.create_resource.campaign_asset do |ca|
            ca.campaign = campaign_resource_name
            ca.asset = asset_resource_name
            ca.field_type = :CALLOUT
          end
        end

        asset_idx += 1
      end

      if campaign.structured_snippet.present?
        asset_resource_name = response.mutate_operation_responses[asset_idx].asset_result.resource_name
        asset_id = asset_resource_name.split("/").last

        campaign.structured_snippet.google_customer_id = campaign.google_customer_id
        campaign.structured_snippet.google_asset_id = asset_id
        campaign.structured_snippet.save!

        # Link to campaign
        link_operations << client.operation.mutate do |m|
          m.campaign_asset_operation = client.operation.create_resource.campaign_asset do |ca|
            ca.campaign = campaign_resource_name
            ca.asset = asset_resource_name
            ca.field_type = :STRUCTURED_SNIPPET
          end
        end
      end

      # Execute link operations
      if link_operations.any?
        client.service.google_ads.mutate(
          customer_id: campaign.google_customer_id,
          mutate_operations: link_operations
        )
      end

      Rails.logger.info("Created and linked #{operations.size} assets")
    end

    def create_ad!
      ad_group = campaign.ad_groups.first
      ad = ad_group.ads.first

      google_ad = client.resource.ad do |a|
        a.final_urls << (campaign.final_url || "https://example.com")

        a.responsive_search_ad = client.resource.responsive_search_ad_info do |rsa|
          # Add headlines
          ad.headlines.each do |headline|
            rsa.headlines << client.resource.ad_text_asset do |h|
              h.text = headline.text
              h.pinned_field = headline.pinned_field.to_sym if headline.pinned_field.present?
            end
          end

          # Add descriptions
          ad.descriptions.each do |description|
            rsa.descriptions << client.resource.ad_text_asset do |d|
              d.text = description.text
              d.pinned_field = description.pinned_field.to_sym if description.pinned_field.present?
            end
          end
        end
      end

      ad_group_ad = client.resource.ad_group_ad do |aga|
        aga.ad_group = ad_group_resource_name
        aga.ad = google_ad
        aga.status = :ENABLED
      end

      operation = client.operation.create_resource.ad_group_ad(ad_group_ad)

      response = client.service.ad_group_ad.mutate_ad_group_ads(
        customer_id: campaign.google_customer_id,
        operations: [operation]
      )

      ad_resource_name = response.results.first.resource_name
      # Format: customers/123/adGroupAds/456~789
      parts = ad_resource_name.split("~")

      ad.google_customer_id = campaign.google_customer_id
      ad.google_ad_group_id = ad_group.google_ad_group_id
      ad.google_ad_id = parts.last
      ad.save!

      Rails.logger.info("Created ad: #{ad_resource_name}")
    end

    def enable_campaign!
      operation = client.operation.update_resource.campaign(campaign_resource_name) do |c|
        c.status = :ENABLED
      end

      client.service.campaign.mutate_campaigns(
        customer_id: campaign.google_customer_id,
        operations: [operation]
      )

      campaign.google_status = "ENABLED"

      Rails.logger.info("Enabled campaign: #{campaign_resource_name}")
    end

    def campaign_resource_name
      @campaign_resource_name ||= "customers/#{campaign.google_customer_id}/campaigns/#{campaign.google_campaign_id}"
    end

    def ad_group_resource_name
      ad_group = campaign.ad_groups.first
      @ad_group_resource_name ||= "customers/#{campaign.google_customer_id}/adGroups/#{ad_group.google_ad_group_id}"
    end

    def minute_to_enum(minute)
      case minute
      when 0 then :ZERO
      when 15 then :FIFTEEN
      when 30 then :THIRTY
      when 45 then :FORTY_FIVE
      else :ZERO
      end
    end

    def handle_google_ads_error(error)
      error.failure.errors.each do |err|
        error_message = "Google Ads Error: #{err.message}"

        if err.location
          fields = err.location.field_path_elements.map(&:field_name).join(".")
          error_message += " (field: #{fields})"
        end

        err.error_code.to_h.each do |k, v|
          next if v == :UNSPECIFIED
          error_message += " [#{k}: #{v}]"
        end

        @errors << error_message
        Rails.logger.error(error_message)
      end
    end

    def success_result
      OpenStruct.new(success?: true, campaign: campaign)
    end

    def error_result(message)
      OpenStruct.new(success?: false, error: message, errors: @errors)
    end
  end
end
