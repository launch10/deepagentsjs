module GoogleAds
  class Callout < Sync::Syncable
    def campaign
      local_resource.campaign
    end

    def fetch_remote
      fetch_by_id || fetch_by_content
    end

    def build_comparisons
      return [] unless local_resource && remote_resource

      field_mappings = Sync::FieldMappings.for(local_resource.class)
      comparisons = []

      field_mappings.each do |_key, mapping|
        our_field = mapping[:our_field]
        our_value = local_resource.respond_to?(our_field) ? local_resource.send(our_field) : nil
        next if our_value.nil?

        their_value = if mapping[:nested_field]
          nested = remote_resource.respond_to?(mapping[:nested_field]) ? remote_resource.send(mapping[:nested_field]) : nil
          nested&.respond_to?(mapping[:their_field]) ? nested.send(mapping[:their_field]) : nil
        else
          remote_resource.respond_to?(mapping[:their_field]) ? remote_resource.send(mapping[:their_field]) : nil
        end

        comparisons << Sync::FieldComparison.new(
          field: our_field,
          our_field: mapping[:our_field],
          our_value: our_value,
          their_field: mapping[:their_field],
          their_value: their_value,
          transform: mapping[:transform]
        )
      end

      comparisons
    end

    def fetch_by_id
      return nil unless remote_asset_id.present?

      query = %(
        SELECT asset.id, asset.resource_name, asset.callout_asset.callout_text
        FROM asset
        WHERE asset.id = #{remote_asset_id}
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      results.first&.asset
    end

    def fetch_by_content
      return nil unless local_resource.text.present?

      escaped_text = local_resource.text.gsub("'", "\\\\'")
      query = %(
        SELECT asset.id, asset.resource_name, asset.callout_asset.callout_text
        FROM asset
        WHERE asset.type = 'CALLOUT'
          AND asset.callout_asset.callout_text = '#{escaped_text}'
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      asset = results.first&.asset

      if asset
        local_resource.update_column(:platform_settings,
          local_resource.platform_settings.deep_merge("google" => { "asset_id" => asset.id.to_s }))
      end

      asset
    end

    def sync_result
      return not_found_result(:asset) unless remote_resource

      Sync::SyncResult.new(
        resource_type: :asset,
        resource_name: remote_resource.resource_name,
        action: :unchanged,
        comparisons: build_comparisons
      )
    end

    def sync
      return sync_result if synced?

      if remote_resource
        sync_result
      else
        create_callout_asset
      end
    end

    def delete
      return not_found_result(:campaign_asset) unless remote_asset_id.present?

      campaign_asset_resource_name = "customers/#{google_customer_id}/campaignAssets/#{google_campaign_id}~#{remote_asset_id}~CALLOUT"

      operation = client.operation.remove_resource.campaign_asset(campaign_asset_resource_name)

      begin
        client.service.campaign_asset.mutate_campaign_assets(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:campaign_asset, e)
      end

      local_resource.google_asset_id = nil
      local_resource.save!

      clear_memoization

      Sync::SyncResult.new(
        resource_type: :campaign_asset,
        resource_name: nil,
        action: :deleted,
        comparisons: []
      )
    end

    private

    def remote_asset_id
      local_resource.google_asset_id
    end
    memoize :remote_asset_id

    def google_customer_id
      campaign.google_customer_id.to_s
    end

    def google_campaign_id
      campaign.google_campaign_id.to_s
    end

    def campaign_resource_name
      "customers/#{google_customer_id}/campaigns/#{google_campaign_id}"
    end

    def create_callout_asset
      asset_operation = client.operation.create_resource.asset do |asset|
        asset.callout_asset = client.resource.callout_asset do |ca|
          ca.callout_text = local_resource.text
        end
      end

      begin
        asset_response = client.service.asset.mutate_assets(
          customer_id: google_customer_id,
          operations: [asset_operation]
        )
      rescue => e
        return error_result(:asset, e)
      end

      asset_resource_name = asset_response.results.first.resource_name
      asset_id = asset_resource_name.split("/").last.to_i
      local_resource.google_asset_id = asset_id
      local_resource.save!

      link_operation = client.operation.create_resource.campaign_asset do |ca|
        ca.campaign = campaign_resource_name
        ca.asset = asset_resource_name
        ca.field_type = :CALLOUT
      end

      begin
        client.service.campaign_asset.mutate_campaign_assets(
          customer_id: google_customer_id,
          operations: [link_operation]
        )
      rescue => e
        return error_result(:campaign_asset, e)
      end

      verify_sync(:created, asset_resource_name)
    end

    def verify_sync(action, resource_name)
      clear_memoization
      fetch_remote

      Sync::SyncResult.new(
        resource_type: :asset,
        resource_name: resource_name,
        action: action,
        comparisons: build_comparisons
      )
    end

    def clear_memoization
      flush_cache(:remote_resource)
      flush_cache(:synced?)
      flush_cache(:sync_result)
      flush_cache(:remote_asset_id)
    end
  end
end
