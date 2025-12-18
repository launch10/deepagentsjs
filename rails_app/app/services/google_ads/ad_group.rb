module GoogleAds
  class AdGroup < Sync::Syncable
    def campaign
      local_resource.campaign
    end

    def fetch_remote
      fetch_by_id || fetch_by_name
    end

    def fetch_by_id
      return nil unless ad_group_id.present?

      query = %(
        SELECT ad_group.resource_name, ad_group.id, ad_group.name, ad_group.status, ad_group.type, ad_group.cpc_bid_micros
        FROM ad_group
        WHERE ad_group.id = #{ad_group_id}
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      results.first&.ad_group
    end

    def fetch_by_name
      ad_group_name = local_resource&.name
      return nil unless ad_group_name.present?

      query = %(
        SELECT ad_group.resource_name, ad_group.id, ad_group.name, ad_group.status, ad_group.type, ad_group.cpc_bid_micros
        FROM ad_group
        WHERE ad_group.name = '#{ad_group_name}'
        AND ad_group.campaign = '#{campaign_resource_name}'
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      ad_group = results.first&.ad_group
      return nil unless ad_group

      local_resource.google_ad_group_id = ad_group.id
      ad_group
    end

    def sync_result
      return not_found_result(:ad_group) unless remote_resource

      Sync::SyncResult.new(
        resource_type: :ad_group,
        resource_name: remote_resource.resource_name,
        action: :unchanged,
        comparisons: build_comparisons
      )
    end

    def sync
      return sync_result if synced?

      if remote_resource
        update_ad_group
      else
        create_ad_group
      end
    end

    private

    def ad_group_id
      local_resource.google_ad_group_id
    end
    memoize :ad_group_id

    def google_customer_id
      local_resource.google_customer_id.to_s
    end

    def google_campaign_id
      campaign.google_campaign_id.to_s
    end

    def campaign_resource_name
      "customers/#{google_customer_id}/campaigns/#{google_campaign_id}"
    end

    def create_ad_group
      operation = client.operation.create_resource.ad_group do |ag|
        ag.name = local_resource.name
        ag.campaign = campaign_resource_name
        ag.type = :SEARCH_STANDARD
        ag.status = :PAUSED
        ag.cpc_bid_micros = 1_000_000
      end

      begin
        response = client.service.ad_group.mutate_ad_groups(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:ad_group, e)
      end

      resource_name = response.results.first.resource_name
      ad_group_id = resource_name.split("/").last.to_i
      local_resource.google_ad_group_id = ad_group_id

      verify_sync(:created, resource_name)
    end

    def update_ad_group
      comparisons = build_comparisons
      resource_name = remote_resource.resource_name

      operation = client.operation.update_resource.ad_group(resource_name) do |ag|
        comparisons.each do |comparison|
          next if comparison.values_match?
          case comparison.their_field
          when :name
            ag.name = comparison.transformed_our_value
          when :status
            ag.status = comparison.transformed_our_value
          when :cpc_bid_micros
            ag.cpc_bid_micros = comparison.transformed_our_value
          end
        end
      end

      begin
        client.service.ad_group.mutate_ad_groups(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:ad_group, e)
      end

      verify_sync(:updated, resource_name)
    end

    def verify_sync(action, resource_name)
      clear_memoization
      fetch_remote

      Sync::SyncResult.new(
        resource_type: :ad_group,
        resource_name: resource_name,
        action: action,
        comparisons: build_comparisons
      )
    end

    def clear_memoization
      flush_cache(:remote_resource)
      flush_cache(:synced?)
      flush_cache(:sync_result)
      flush_cache(:ad_group_id)
    end
  end
end
