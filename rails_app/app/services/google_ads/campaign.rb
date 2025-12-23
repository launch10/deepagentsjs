module GoogleAds
  class Campaign < Sync::Syncable
    def fetch_remote
      fetch_by_id || fetch_by_name
    end

    def fetch_by_id
      return nil unless campaign_id.present?

      query = %(
        SELECT campaign.resource_name, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type
        FROM campaign
        WHERE campaign.id = #{campaign_id}
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      results.first&.campaign
    end

    def fetch_by_name
      campaign_name = local_resource&.name
      return nil unless campaign_name.present?

      query = %(
        SELECT campaign.resource_name, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type
        FROM campaign
        WHERE campaign.name = '#{campaign_name}'
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      campaign = results.first&.campaign
      return nil unless campaign

      local_resource.google_campaign_id = campaign.id
      campaign
    end

    def sync_result
      return not_found_result(:campaign) unless remote_resource

      Sync::SyncResult.new(
        resource_type: :campaign,
        resource_name: remote_resource.resource_name,
        action: :unchanged,
        comparisons: build_comparisons
      )
    end

    def sync
      return sync_result if synced?

      if remote_resource
        update_campaign
      else
        create_campaign
      end
    end

    private

    def campaign_id
      local_resource.google_campaign_id
    end
    memoize :campaign_id

    def google_customer_id
      local_resource.google_customer_id.to_s
    end

    def attrs
      local_resource&.to_google_json || {}
    end

    def budget_resource_name
      budget = local_resource.budget
      return nil unless budget&.google_budget_id

      "customers/#{google_customer_id}/campaignBudgets/#{budget.google_budget_id}"
    end

    def set_bidding_strategy(campaign_operation)
      # Option 1: TargetSpend (closest to MaximizeClicks behavior) - This is the only thing we support for now
      campaign_operation.target_spend = Google::Ads::GoogleAds::V22::Common::TargetSpend.new

      # Option 2: MaximizeConversions
      # campaign_operation.maximize_conversions = Google::Ads::GoogleAds::V22::Common::MaximizeConversions.new
    end

    def create_campaign
      operation = client.operation.create_resource.campaign do |c|
        c.name = attrs[:name]
        c.advertising_channel_type = attrs[:advertising_channel_type]
        c.status = attrs[:status]
        c.campaign_budget = budget_resource_name if budget_resource_name
        c.start_date = local_resource.start_date.strftime("%Y%m%d") if local_resource.start_date
        c.end_date = local_resource.end_date.strftime("%Y%m%d") if local_resource.end_date
        c.network_settings = local_resource.google_network_settings_for_api(client)
        c.contains_eu_political_advertising = attrs[:contains_eu_political_advertising]
        set_bidding_strategy(c)
      end

      begin
        response = client.service.campaign.mutate_campaigns(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        binding.pry
        return error_result(:campaign, e)
      end

      resource_name = response.results.first.resource_name
      campaign_id = resource_name.split("/").last.to_i
      local_resource.google_campaign_id = campaign_id

      verify_sync(:created, resource_name)
    end

    def update_campaign
      comparisons = build_comparisons
      fields_to_update = comparisons.reject(&:values_match?)
      return if fields_to_update.empty?

      resource_name = remote_resource.resource_name

      operation = client.operation.update_resource.campaign(resource_name) do |c|
        comparisons.each do |comparison|
          next if comparison.values_match?
          case comparison.their_field
          when :name
            c.name = comparison.transformed_our_value
          when :status
            c.status = comparison.transformed_our_value
          when :advertising_channel_type
            c.advertising_channel_type = comparison.transformed_our_value
          end
        end
      end

      begin
        client.service.campaign.mutate_campaigns(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        binding.pry
      end

      verify_sync(:updated, resource_name)
    end

    def verify_sync(action, resource_name)
      clear_memoization
      fetch_remote

      Sync::SyncResult.new(
        resource_type: :campaign,
        resource_name: resource_name,
        action: action,
        comparisons: build_comparisons
      )
    end

    def clear_memoization
      flush_cache(:remote_resource)
      flush_cache(:synced?)
      flush_cache(:sync_result)
    end
  end
end
